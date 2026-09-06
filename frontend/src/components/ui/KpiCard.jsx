// Cartes KPI : "grandes et lisibles" (_docs/07_UI_UX_DESIGN_GUIDELINES.txt, section 4)
// Palette limitée à 4 couleurs (section 5) : bleu (info/actions), vert (succès),
// orange (alerte), rouge (erreur).
const COLOR_STYLES = {
  blue: { bg: 'bg-primary-50', text: 'text-primary-700', icon: 'text-primary-600' },
  green: { bg: 'bg-green-50', text: 'text-green-700', icon: 'text-green-600' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-700', icon: 'text-orange-600' },
  red: { bg: 'bg-red-50', text: 'text-red-700', icon: 'text-red-600' },
};

const KpiCard = ({ label, value, icon: Icon, color = 'blue', suffix }) => {
  const styles = COLOR_STYLES[color] || COLOR_STYLES.blue;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
      <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${styles.bg}`}>
        <Icon size={28} className={styles.icon} strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-500 truncate">{label}</p>
        <p className={`text-2xl md:text-3xl font-bold ${styles.text} truncate`}>
          {value}
          {suffix && <span className="text-base font-medium ml-1">{suffix}</span>}
        </p>
      </div>
    </div>
  );
};

export default KpiCard;
