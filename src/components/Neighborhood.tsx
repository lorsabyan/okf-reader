import { conceptHref } from '@/lib/paths';

interface Node {
  id: string;
  title: string;
}

type HrefFor = (id: string) => string;

const ROW = 46;
const BOX_W = 210;
const BOX_H = 34;
const WIDTH = 720;

function truncate(s: string, n = 26) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function NodeBox({
  node,
  x,
  y,
  center = false,
  hrefFor = conceptHref,
}: {
  node: Node;
  x: number;
  y: number;
  center?: boolean;
  hrefFor?: HrefFor;
}) {
  const box = (
    <g>
      <rect
        x={x}
        y={y}
        width={BOX_W}
        height={BOX_H}
        rx={8}
        className={center ? 'fill-primary/10 stroke-primary' : 'fill-muted stroke-border hover:stroke-primary'}
      />
      <text x={x + BOX_W / 2} y={y + BOX_H / 2 + 4} textAnchor="middle" className="fill-foreground">
        {truncate(node.title)}
      </text>
    </g>
  );
  return center ? (
    box
  ) : (
    <a href={hrefFor(node.id)} aria-label={node.title}>
      {box}
    </a>
  );
}

/**
 * Local-neighborhood graph: inbound concepts on the left, the current
 * concept in the middle, outbound links on the right.
 */
export default function Neighborhood({
  center,
  inbound,
  outbound,
  hrefFor = conceptHref,
}: {
  center: Node;
  inbound: Node[];
  outbound: Node[];
  hrefFor?: HrefFor;
}) {
  if (!inbound.length && !outbound.length) return null;
  const rows = Math.max(inbound.length, outbound.length, 1);
  const height = rows * ROW + 20;
  const midY = height / 2 - BOX_H / 2;
  const cx = WIDTH / 2 - BOX_W / 2;
  const colY = (i: number, n: number) => height / 2 - (n * ROW) / 2 + i * ROW + (ROW - BOX_H) / 2;

  return (
    <figure className="mt-12">
      <figcaption className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Connections
      </figcaption>
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        role="group"
        aria-label={`Concepts linked with ${center.title}`}
        className="mt-2 h-auto w-full text-xs"
      >
        {inbound.map((n, i) => {
          const y = colY(i, inbound.length) + BOX_H / 2;
          return (
            <path
              key={n.id}
              className="fill-none stroke-border stroke-[1.5]"
              d={`M ${10 + BOX_W} ${y} C ${cx - 60} ${y}, ${10 + BOX_W + 60} ${midY + BOX_H / 2}, ${cx} ${midY + BOX_H / 2}`}
            />
          );
        })}
        {outbound.map((n, i) => {
          const y = colY(i, outbound.length) + BOX_H / 2;
          return (
            <path
              key={n.id}
              className="fill-none stroke-border stroke-[1.5]"
              d={`M ${cx + BOX_W} ${midY + BOX_H / 2} C ${WIDTH - BOX_W - 70} ${midY + BOX_H / 2}, ${cx + BOX_W + 60} ${y}, ${WIDTH - BOX_W - 10} ${y}`}
            />
          );
        })}
        {inbound.map((n, i) => (
          <NodeBox key={n.id} node={n} x={10} y={colY(i, inbound.length)} hrefFor={hrefFor} />
        ))}
        {outbound.map((n, i) => (
          <NodeBox key={n.id} node={n} x={WIDTH - BOX_W - 10} y={colY(i, outbound.length)} hrefFor={hrefFor} />
        ))}
        <NodeBox node={center} x={cx} y={midY} center />
      </svg>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>← cited by</span>
        <span>links to →</span>
      </div>
    </figure>
  );
}
