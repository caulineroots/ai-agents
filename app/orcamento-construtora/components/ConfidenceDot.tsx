export function ConfidenceDot({ value }: { value: number }) {
  const color = value >= 80 ? 'bg-green-500' : value >= 50 ? 'bg-yellow-400' : 'bg-red-400';
  return (
    <span title={`Confiança: ${value}%`} className="inline-flex items-center gap-1 text-xs font-medium text-gray-500">
      <span className={`w-1.5 h-1.5 rounded-full inline-block ${color}`} />
      {value}%
    </span>
  );
}
