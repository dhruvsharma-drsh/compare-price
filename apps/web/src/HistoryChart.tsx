import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  TimeScale
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, TimeScale);

type Series = {
  listingId: string;
  platform: string;
  country: string;
  currency: string;
  baseCurrency: string;
  points: { at: string; local: number | null; converted: number | null }[];
};

export function HistoryChart(props: { series: Series[] }) {
  const labels = Array.from(
    new Set(props.series.flatMap((s) => s.points.map((p) => new Date(p.at).toLocaleDateString())))
  );

  const datasets = props.series.map((s, idx) => {
    const color = ["#22c55e", "#60a5fa", "#f97316", "#e879f9", "#f43f5e"][idx % 5];
    const map = new Map(s.points.map((p) => [new Date(p.at).toLocaleDateString(), p.converted]));
    return {
      label: `${s.platform} · ${s.country}`,
      data: labels.map((l) => map.get(l) ?? null),
      borderColor: color,
      backgroundColor: color,
      tension: 0.2,
      spanGaps: true
    };
  });

  return (
    <Line
      data={{ labels, datasets }}
      options={{
        responsive: true,
        plugins: { legend: { position: "bottom" } },
        scales: {
          y: { ticks: { callback: (v) => String(v) } }
        }
      }}
    />
  );
}

