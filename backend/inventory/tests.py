from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.exceptions import ValidationError

from companies.models import Company, Store
from products.models import Product, StockLevel
from .models import InventoryMovement, Warehouse
from .services import apply_movement, revert_movement, adjust_movement, resolve_warehouse
from .validators import assert_hierarchy

User = get_user_model()


class StockServicesTestCase(TestCase):
    """Tests du point d'entrée unique d'écriture de stock (_docs/15, étape 0)."""

    def setUp(self):
        self.company = Company.objects.create(name='Entreprise Test')
        self.other_company = Company.objects.create(name='Autre Entreprise')
        self.store = Store.objects.create(company=self.company, name='Magasin A')
        self.store_b = Store.objects.create(company=self.company, name='Magasin B')
        self.other_store = Store.objects.create(company=self.other_company, name='Magasin X')
        self.user = User.objects.create_user(
            email='test@example.com', password='pass1234',
            first_name='Test', last_name='User',
        )
        self.product = Product.objects.create(
            company=self.company, store=self.store, name='Produit X',
        )
        self.other_product = Product.objects.create(
            company=self.other_company, store=self.other_store, name='Produit Y',
        )

    def _qty(self, product=None, store=None):
        level = StockLevel.objects.filter(
            product=product or self.product, store=store or self.store,
        ).first()
        return level.quantity if level else 0

    # --- apply_movement -----------------------------------------------------

    def test_apply_in_creates_movement_and_stock(self):
        m = apply_movement(
            company=self.company, store=self.store, product=self.product,
            movement_type='in', quantity=10, user=self.user,
        )
        self.assertEqual(self._qty(), 10)
        self.assertEqual(m.stock_before, 0)
        self.assertEqual(m.stock_after, 10)
        self.assertEqual(m.created_by, self.user)

    def test_apply_out_decrements_stock(self):
        apply_movement(company=self.company, store=self.store,
                       product=self.product, movement_type='in', quantity=10)
        m = apply_movement(company=self.company, store=self.store,
                           product=self.product, movement_type='out', quantity=4)
        self.assertEqual(self._qty(), 6)
        self.assertEqual(m.stock_before, 10)
        self.assertEqual(m.stock_after, 6)

    def test_out_refuses_negative_stock(self):
        apply_movement(company=self.company, store=self.store,
                       product=self.product, movement_type='in', quantity=3)
        with self.assertRaises(ValidationError):
            apply_movement(company=self.company, store=self.store,
                           product=self.product, movement_type='out', quantity=5)
        # Le stock n'a pas bougé
        self.assertEqual(self._qty(), 3)

    def test_adjustment_applies_signed_delta(self):
        apply_movement(company=self.company, store=self.store,
                       product=self.product, movement_type='in', quantity=10)
        m = apply_movement(company=self.company, store=self.store,
                           product=self.product, movement_type='adjustment',
                           quantity=-4)
        self.assertEqual(self._qty(), 6)
        self.assertEqual(m.stock_after, 6)

    def test_apply_rejects_foreign_product(self):
        with self.assertRaises(ValidationError):
            apply_movement(company=self.company, store=self.store,
                           product=self.other_product, movement_type='in',
                           quantity=1)

    def test_apply_rejects_foreign_store(self):
        with self.assertRaises(ValidationError):
            apply_movement(company=self.company, store=self.other_store,
                           product=self.product, movement_type='in',
                           quantity=1)

    def test_apply_requires_store(self):
        with self.assertRaises(ValidationError):
            apply_movement(company=self.company, store=None,
                           product=self.product, movement_type='in',
                           quantity=1)

    def test_source_is_recorded(self):
        apply_movement(company=self.company, store=self.store,
                       product=self.product, movement_type='in', quantity=5)
        sale_like = self.product  # tout objet avec .uuid fait office de source
        m = apply_movement(company=self.company, store=self.store,
                           product=self.product, movement_type='out',
                           quantity=1, source=sale_like)
        self.assertEqual(m.source_type, 'Product')
        self.assertEqual(m.source_uuid, self.product.uuid)

    # --- revert_movement ----------------------------------------------------

    def test_revert_restores_stock_and_deletes(self):
        m = apply_movement(company=self.company, store=self.store,
                           product=self.product, movement_type='in', quantity=7)
        revert_movement(m)
        self.assertEqual(self._qty(), 0)
        self.assertFalse(InventoryMovement.objects.filter(pk=m.pk).exists())

    def test_revert_refuses_sourced_movement(self):
        m = apply_movement(company=self.company, store=self.store,
                           product=self.product, movement_type='out',
                           quantity=0, source=self.product)
        with self.assertRaises(ValidationError):
            revert_movement(m)

    # --- adjust_movement ----------------------------------------------------

    def test_adjust_movement_reapplies_stock(self):
        m = apply_movement(company=self.company, store=self.store,
                           product=self.product, movement_type='in', quantity=5)
        adjust_movement(m, new_type='in', new_quantity=8, new_store=self.store)
        self.assertEqual(self._qty(), 8)
        m.refresh_from_db()
        self.assertEqual(m.stock_after, 8)

    def test_adjust_movement_can_change_store(self):
        m = apply_movement(company=self.company, store=self.store,
                           product=self.product, movement_type='in', quantity=5)
        adjust_movement(m, new_type='in', new_quantity=5, new_store=self.store_b)
        self.assertEqual(self._qty(store=self.store), 0)
        self.assertEqual(self._qty(store=self.store_b), 5)


class AssertHierarchyTestCase(TestCase):
    """Tests de cohérence hiérarchique (_docs/14, R84-R90)."""

    def setUp(self):
        self.company = Company.objects.create(name='Entreprise Test')
        self.other_company = Company.objects.create(name='Autre Entreprise')
        self.store = Store.objects.create(company=self.company, name='Magasin A')
        self.other_store = Store.objects.create(
            company=self.other_company, name='Magasin X',
        )

    def test_valid_store_passes(self):
        self.assertEqual(
            assert_hierarchy(self.company, store=self.store), self.store
        )

    def test_foreign_store_rejected(self):
        with self.assertRaises(ValidationError):
            assert_hierarchy(self.company, store=self.other_store)

    def test_no_company_rejected(self):
        with self.assertRaises(ValidationError):
            assert_hierarchy(None, store=self.store)

    def test_warehouse_store_mismatch_rejected(self):
        # Simule un entrepôt (duck-typing : seul .store est lu)
        class FakeWarehouse:
            def __init__(self, store):
                self.store = store
                self.id = 1

        wh = FakeWarehouse(self.store)
        with self.assertRaises(ValidationError):
            assert_hierarchy(
                self.company, store=self.other_store, warehouse=wh,
            )

    def test_warehouse_derives_store(self):
        class FakeWarehouse:
            def __init__(self, store):
                self.store = store
                self.id = 1

        wh = FakeWarehouse(self.store)
        self.assertEqual(
            assert_hierarchy(self.company, warehouse=wh), self.store
        )


class WarehouseTestCase(TestCase):
    """Entrepôts (_docs/15, étape 1.10)."""

    def setUp(self):
        self.company = Company.objects.create(name='Entreprise Test')
        self.other_company = Company.objects.create(name='Autre Entreprise')
        # Le signal post_save crée automatiquement l'entrepôt Principal.
        self.store = Store.objects.create(company=self.company, name='Magasin A')
        self.other_store = Store.objects.create(
            company=self.other_company, name='Magasin X',
        )
        self.product = Product.objects.create(
            company=self.company, store=self.store, name='Produit X',
        )

    def test_principal_warehouse_auto_created(self):
        wh = Warehouse.objects.get(store=self.store)
        self.assertEqual(wh.name, 'Principal')
        self.assertEqual(wh.code, 'MAIN')
        self.assertTrue(wh.is_default)

    def test_only_one_default_per_store(self):
        from django.db import IntegrityError
        with self.assertRaises(IntegrityError):
            Warehouse.objects.create(
                company=self.company, store=self.store,
                name='Second défaut', code='DEF2', is_default=True,
            )

    def test_movement_uses_default_warehouse(self):
        m = apply_movement(
            company=self.company, store=self.store, product=self.product,
            movement_type='in', quantity=5,
        )
        self.assertEqual(m.warehouse, Warehouse.objects.get(store=self.store))

    def test_store_total_is_sum_of_warehouses(self):
        main = Warehouse.objects.get(store=self.store)
        second = Warehouse.objects.create(
            company=self.company, store=self.store,
            name='Réserve', code='RES', type='reserve',
        )
        apply_movement(company=self.company, store=self.store,
                       warehouse=main, product=self.product,
                       movement_type='in', quantity=10)
        apply_movement(company=self.company, store=self.store,
                       warehouse=second, product=self.product,
                       movement_type='in', quantity=4)
        self.assertEqual(self.product.stock_for_store(self.store), 14)
        self.assertEqual(self.product.stock_for_warehouse(main), 10)
        self.assertEqual(self.product.stock_for_warehouse(second), 4)

    def test_warehouse_of_other_store_rejected(self):
        foreign_wh = Warehouse.objects.get(store=self.other_store)
        with self.assertRaises(ValidationError):
            apply_movement(
                company=self.company, store=self.store,
                warehouse=foreign_wh, product=self.product,
                movement_type='in', quantity=1,
            )

    def test_stock_levels_are_per_warehouse(self):
        main = Warehouse.objects.get(store=self.store)
        second = Warehouse.objects.create(
            company=self.company, store=self.store,
            name='Réserve', code='RES', type='reserve',
        )
        apply_movement(company=self.company, store=self.store,
                       warehouse=main, product=self.product,
                       movement_type='in', quantity=10)
        # Sortir plus que le stock de la réserve (vide) doit échouer.
        with self.assertRaises(ValidationError):
            apply_movement(company=self.company, store=self.store,
                           warehouse=second, product=self.product,
                           movement_type='out', quantity=1)


class TransferWorkflowTestCase(TestCase):
    """Transferts avec statuts (_docs/15, étape 3.6 : invariants)."""

    def setUp(self):
        self.company = Company.objects.create(name='Entreprise Test')
        self.store_a = Store.objects.create(company=self.company, name='Magasin A')
        self.store_b = Store.objects.create(company=self.company, name='Magasin B')
        self.wh_a = Warehouse.objects.get(store=self.store_a)
        self.wh_b = Warehouse.objects.get(store=self.store_b)
        self.wh_a2 = Warehouse.objects.create(
            company=self.company, store=self.store_a,
            name='Réserve', code='RES', type='reserve',
        )
        self.user = User.objects.create_user(
            email='t@example.com', password='pass1234',
            first_name='T', last_name='U',
        )
        self.product = Product.objects.create(
            company=self.company, store=self.store_a, name='Produit X',
        )

    def _make_transfer(self, from_wh=None, to_wh=None, qty=5):
        from .models import Transfer, TransferItem
        t = Transfer.objects.create(
            company=self.company,
            from_store=self.store_a, to_store=self.store_b,
            from_warehouse=from_wh or self.wh_a,
            to_warehouse=to_wh or self.wh_b,
            transfer_type='inter_store',
        )
        TransferItem.objects.create(
            transfer=t, product=self.product, quantity_requested=qty,
        )
        return t

    def _tenant_total(self):
        from django.db.models import Sum
        from .models import TransferItem
        stock = StockLevel.objects.filter(
            product__company=self.company,
        ).aggregate(t=Sum('quantity'))['t'] or 0
        transit = TransferItem.objects.filter(
            transfer__company=self.company, transfer__status='in_transit',
        ).aggregate(t=Sum('quantity_shipped'))['t'] or 0
        return stock + transit

    def test_immediate_transfer_moves_stock(self):
        from .transfer_workflow import run_immediate
        apply_movement(company=self.company, store=self.store_a,
                       warehouse=self.wh_a, product=self.product,
                       movement_type='in', quantity=10)
        t = self._make_transfer(qty=4)
        run_immediate(t, user=self.user)
        t.refresh_from_db()
        self.assertEqual(t.status, 'received')
        self.assertEqual(self.product.stock_for_warehouse(self.wh_a), 6)
        self.assertEqual(self.product.stock_for_warehouse(self.wh_b), 4)

    def test_tenant_total_unchanged_during_transit(self):
        """R26-R27 : total tenant (stocks + transit) constant à chaque étape."""
        from . import transfer_workflow as wf
        apply_movement(company=self.company, store=self.store_a,
                       warehouse=self.wh_a, product=self.product,
                       movement_type='in', quantity=10)
        before = self._tenant_total()
        t = self._make_transfer(qty=4)
        wf.request_transfer(t, user=self.user)
        wf.validate_transfer(t, user=self.user)
        wf.prepare_transfer(t, user=self.user)
        wf.ship_transfer(t, user=self.user)
        t.refresh_from_db()
        self.assertEqual(t.status, 'in_transit')
        # Le stock a quitté la source mais est en transit : total inchangé.
        self.assertEqual(self._tenant_total(), before)
        wf.receive_transfer(t, user=self.user)
        self.assertEqual(self._tenant_total(), before)

    def test_inter_warehouse_keeps_store_total(self):
        from .transfer_workflow import run_immediate
        apply_movement(company=self.company, store=self.store_a,
                       warehouse=self.wh_a, product=self.product,
                       movement_type='in', quantity=10)
        t = self._make_transfer(from_wh=self.wh_a, to_wh=self.wh_a2, qty=3)
        t.to_store = self.store_a
        t.save()
        run_immediate(t, user=self.user)
        self.assertEqual(self.product.stock_for_store(self.store_a), 10)
        self.assertEqual(self.product.stock_for_warehouse(self.wh_a), 7)
        self.assertEqual(self.product.stock_for_warehouse(self.wh_a2), 3)

    def test_receive_discrepancy_creates_loss(self):
        from . import transfer_workflow as wf
        apply_movement(company=self.company, store=self.store_a,
                       warehouse=self.wh_a, product=self.product,
                       movement_type='in', quantity=10)
        t = self._make_transfer(qty=5)
        wf.request_transfer(t, user=self.user)
        wf.validate_transfer(t, user=self.user)
        wf.prepare_transfer(t, user=self.user)
        wf.ship_transfer(t, user=self.user)
        item = t.items.first()
        wf.receive_transfer(t, user=self.user, quantities={str(item.id): 3})
        # 3 reçus + 2 perdus : destination = 3, perte enregistrée.
        self.assertEqual(self.product.stock_for_warehouse(self.wh_b), 3)
        loss = InventoryMovement.objects.get(
            type='loss', reason='transfer_discrepancy',
        )
        self.assertEqual(loss.quantity, 2)

    def test_cancel_after_ship_returns_stock(self):
        """R24 : le stock ne disparaît jamais."""
        from . import transfer_workflow as wf
        apply_movement(company=self.company, store=self.store_a,
                       warehouse=self.wh_a, product=self.product,
                       movement_type='in', quantity=10)
        t = self._make_transfer(qty=4)
        wf.request_transfer(t, user=self.user)
        wf.validate_transfer(t, user=self.user)
        wf.prepare_transfer(t, user=self.user)
        wf.ship_transfer(t, user=self.user)
        wf.cancel_transfer(t, user=self.user)
        t.refresh_from_db()
        self.assertEqual(t.status, 'cancelled')
        self.assertEqual(self.product.stock_for_warehouse(self.wh_a), 10)
        self.assertEqual(self.product.stock_for_warehouse(self.wh_b), 0)

    def test_no_sale_or_purchase_movements(self):
        """R76-R79 : un transfert ne crée jamais de mouvement sale_*/purchase_*."""
        from .transfer_workflow import run_immediate
        apply_movement(company=self.company, store=self.store_a,
                       warehouse=self.wh_a, product=self.product,
                       movement_type='in', quantity=10)
        t = self._make_transfer(qty=4)
        run_immediate(t, user=self.user)
        bad = InventoryMovement.objects.filter(
            type__startswith='sale',
        ) | InventoryMovement.objects.filter(type__startswith='purchase')
        self.assertFalse(bad.exists())

    def test_invalid_transition_rejected(self):
        from . import transfer_workflow as wf
        t = self._make_transfer()
        with self.assertRaises(ValidationError):
            wf.ship_transfer(t, user=self.user)  # draft -> ship interdit
        with self.assertRaises(ValidationError):
            wf.receive_transfer(t, user=self.user)


class VariantLotTestCase(TestCase):
    """Tests des variantes et lots (_docs/15, étape 4, R59-R63)."""

    def setUp(self):
        self.company = Company.objects.create(name='Entreprise Test')
        self.other_company = Company.objects.create(name='Autre Entreprise')
        self.store = Store.objects.create(company=self.company, name='Magasin A')
        self.other_store = Store.objects.create(
            company=self.other_company, name='Magasin X')
        self.user = User.objects.create_user(
            email='test@example.com', password='pass1234',
            first_name='Test', last_name='User',
        )
        self.product = Product.objects.create(
            company=self.company, store=self.store, name='T-shirt',
        )
        self.other_product = Product.objects.create(
            company=self.other_company, store=self.other_store,
            name='Produit étranger',
        )
        from products.models import Lot, ProductVariant
        self.variant = ProductVariant.objects.create(
            company=self.company, product=self.product,
            attributes={'couleur': 'Noir', 'taille': 'M'},
        )
        self.foreign_variant = ProductVariant.objects.create(
            company=self.other_company, product=self.other_product,
            attributes={'couleur': 'X'},
        )
        self.lot = Lot.objects.create(
            company=self.company, product=self.product, number='LOT-001',
        )

    def _qty(self, variant=None, lot=None):
        level = StockLevel.objects.filter(
            product=self.product, store=self.store,
            variant=variant, lot=lot,
        ).first()
        return level.quantity if level else 0

    def test_stock_per_variant_isolated(self):
        """Le stock est suivi par variante (4.2) : deux variantes du même
        produit ont des lignes de stock distinctes."""
        from products.models import ProductVariant
        v2 = ProductVariant.objects.create(
            company=self.company, product=self.product,
            attributes={'couleur': 'Blanc'},
        )
        apply_movement(company=self.company, store=self.store,
                       product=self.product, variant=self.variant,
                       movement_type='in', quantity=10)
        apply_movement(company=self.company, store=self.store,
                       product=self.product, variant=v2,
                       movement_type='in', quantity=5)
        self.assertEqual(self._qty(variant=self.variant), 10)
        self.assertEqual(self._qty(variant=v2), 5)
        # Le total produit agrège toutes les variantes.
        self.assertEqual(self.product.stock_quantity, 15)

    def test_stock_per_lot_isolated(self):
        from products.models import Lot
        lot2 = Lot.objects.create(
            company=self.company, product=self.product, number='LOT-002')
        apply_movement(company=self.company, store=self.store,
                       product=self.product, lot=self.lot,
                       movement_type='in', quantity=7)
        apply_movement(company=self.company, store=self.store,
                       product=self.product, lot=lot2,
                       movement_type='in', quantity=3)
        self.assertEqual(self._qty(lot=self.lot), 7)
        self.assertEqual(self._qty(lot=lot2), 3)

    def test_variant_of_other_product_rejected(self):
        """R59 : une variante d'un autre produit est refusée."""
        with self.assertRaises(ValidationError):
            apply_movement(company=self.company, store=self.store,
                           product=self.product, variant=self.foreign_variant,
                           movement_type='in', quantity=1)

    def test_lot_of_other_product_rejected(self):
        """R59 : un lot d'un autre produit est refusé."""
        from products.models import Lot
        foreign_lot = Lot.objects.create(
            company=self.other_company, product=self.other_product,
            number='LOT-X')
        with self.assertRaises(ValidationError):
            apply_movement(company=self.company, store=self.store,
                           product=self.product, lot=foreign_lot,
                           movement_type='in', quantity=1)

    def test_lot_variant_mismatch_rejected(self):
        """Un lot rattaché à une variante ne peut pas être utilisé avec
        une autre variante."""
        from products.models import Lot, ProductVariant
        v2 = ProductVariant.objects.create(
            company=self.company, product=self.product,
            attributes={'taille': 'L'})
        bound_lot = Lot.objects.create(
            company=self.company, product=self.product,
            variant=self.variant, number='LOT-V1')
        with self.assertRaises(ValidationError):
            apply_movement(company=self.company, store=self.store,
                           product=self.product, variant=v2, lot=bound_lot,
                           movement_type='in', quantity=1)

    def test_lot_number_unique_per_product(self):
        """UNIQUE(product, number) : deux lots du même produit ne peuvent
        pas porter le même numéro."""
        from products.models import Lot
        with self.assertRaises(Exception):
            Lot.objects.create(
                company=self.company, product=self.product,
                number='LOT-001')

    def test_movement_records_variant_and_lot(self):
        m = apply_movement(company=self.company, store=self.store,
                           product=self.product, variant=self.variant,
                           lot=self.lot, movement_type='in', quantity=4)
        self.assertEqual(m.variant, self.variant)
        self.assertEqual(m.lot, self.lot)
        self.assertEqual(self._qty(variant=self.variant, lot=self.lot), 4)


class ReservationTestCase(TestCase):
    """Réservations de stock (_docs/15, étape 5, R64-R66)."""

    def setUp(self):
        self.company = Company.objects.create(name='Entreprise Test')
        self.store_a = Store.objects.create(company=self.company, name='Magasin A')
        self.store_b = Store.objects.create(company=self.company, name='Magasin B')
        self.wh_a = Warehouse.objects.get(store=self.store_a)
        self.wh_b = Warehouse.objects.get(store=self.store_b)
        self.user = User.objects.create_user(
            email='r@example.com', password='pass1234',
            first_name='R', last_name='U',
        )
        self.product = Product.objects.create(
            company=self.company, store=self.store_a, name='Produit X',
        )
        apply_movement(
            company=self.company, store=self.store_a,
            warehouse=self.wh_a, product=self.product,
            movement_type='in', quantity=10,
        )

    def _available(self):
        from .services import store_available
        return store_available(product=self.product, store=self.store_a)

    def test_reserve_reduces_available_not_physical(self):
        """R64-R65 : une réservation bloque le disponible sans sortir le stock."""
        from .services import reserve_stock
        reserve_stock(
            company=self.company, store=self.store_a,
            warehouse=self.wh_a, product=self.product, quantity=4,
        )
        self.assertEqual(self.product.stock_for_warehouse(self.wh_a), 10)
        self.assertEqual(self._available(), 6)

    def test_reserve_refuses_insufficient_available(self):
        from .services import reserve_stock
        reserve_stock(
            company=self.company, store=self.store_a,
            warehouse=self.wh_a, product=self.product, quantity=8,
        )
        with self.assertRaises(ValidationError):
            reserve_stock(
                company=self.company, store=self.store_a,
                warehouse=self.wh_a, product=self.product, quantity=3,
            )

    def test_release_frees_available(self):
        from .services import release_reservations, reserve_stock
        r = reserve_stock(
            company=self.company, store=self.store_a,
            warehouse=self.wh_a, product=self.product, quantity=4,
            source=self.product,
        )
        self.assertEqual(self._available(), 6)
        release_reservations(self.product)
        r.refresh_from_db()
        self.assertEqual(r.status, 'released')
        self.assertEqual(self._available(), 10)

    def test_consume_marks_reservation(self):
        from .services import consume_reservations, reserve_stock
        r = reserve_stock(
            company=self.company, store=self.store_a,
            warehouse=self.wh_a, product=self.product, quantity=4,
            source=self.product,
        )
        consume_reservations(self.product)
        r.refresh_from_db()
        self.assertEqual(r.status, 'consumed')

    def test_expired_reservation_not_counted(self):
        from django.utils import timezone
        from datetime import timedelta
        from .services import reserve_stock
        reserve_stock(
            company=self.company, store=self.store_a,
            warehouse=self.wh_a, product=self.product, quantity=4,
            expires_at=timezone.now() - timedelta(hours=1),
        )
        # Expirée : ne réduit plus le disponible.
        self.assertEqual(self._available(), 10)

    def test_transfer_request_reserves_and_ship_consumes(self):
        """5.3 : requested réserve sur la source, shipped consomme."""
        from . import transfer_workflow as wf
        from .models import Transfer, TransferItem
        t = Transfer.objects.create(
            company=self.company,
            from_store=self.store_a, to_store=self.store_b,
            from_warehouse=self.wh_a, to_warehouse=self.wh_b,
            transfer_type='inter_store',
        )
        TransferItem.objects.create(
            transfer=t, product=self.product, quantity_requested=4,
        )
        wf.request_transfer(t, user=self.user)
        self.assertEqual(self._available(), 6)
        self.assertEqual(self.product.stock_for_warehouse(self.wh_a), 10)
        wf.validate_transfer(t, user=self.user)
        wf.prepare_transfer(t, user=self.user)
        wf.ship_transfer(t, user=self.user)
        self.assertEqual(self.product.stock_for_warehouse(self.wh_a), 6)
        self.assertEqual(self._available(), 6)

    def test_transfer_cancel_releases_reservation(self):
        from . import transfer_workflow as wf
        from .models import Transfer, TransferItem
        t = Transfer.objects.create(
            company=self.company,
            from_store=self.store_a, to_store=self.store_b,
            from_warehouse=self.wh_a, to_warehouse=self.wh_b,
            transfer_type='inter_store',
        )
        TransferItem.objects.create(
            transfer=t, product=self.product, quantity_requested=4,
        )
        wf.request_transfer(t, user=self.user)
        self.assertEqual(self._available(), 6)
        wf.cancel_transfer(t, user=self.user)
        self.assertEqual(self._available(), 10)
