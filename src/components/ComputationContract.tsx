import { FileCode } from 'lucide-react';
import type { Computation } from '@okf/core';
import { Badge } from '@/components/ui/badge';

/**
 * The contract of an Attested Computation (spec §10.2): how to run it, what the
 * caller may fill in, and what checks the result.
 *
 * Shown above the body, because it frames how the computation below it should
 * be read. The point of the type is that an agent may supply *values* for the
 * declared parameters and must never author or edit the computation — a reader
 * that shows the SQL without showing that boundary invites the misuse the type
 * exists to prevent, so the note is part of the contract, not decoration.
 */
export default function ComputationContract({ contract }: { contract: Computation }) {
  const { runtime, parameters, path, executor, attester } = contract;
  const hasDetail = runtime || parameters.length || path || executor || attester;
  if (!hasDetail) return null;

  return (
    <section className="mt-6 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold tracking-tight">Sanctioned computation</h2>
        {runtime ? (
          <Badge variant="secondary">runtime: {runtime}</Badge>
        ) : (
          <Badge variant="warning">no runtime declared</Badge>
        )}
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        Supply values for the declared parameters only. Do not rewrite or edit the computation —
        the attester compares what actually ran against this contract.
      </p>

      {parameters.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-1 pr-4 font-medium">Parameter</th>
                <th className="pb-1 pr-4 font-medium">Type</th>
                <th className="pb-1 font-medium">Required</th>
              </tr>
            </thead>
            <tbody>
              {parameters.map((p) => (
                <tr key={p.name} className="border-b last:border-0">
                  <td className="py-1 pr-4 font-mono text-xs">{p.name}</td>
                  <td className="py-1 pr-4 text-muted-foreground">{p.type ?? '—'}</td>
                  <td className="py-1 text-muted-foreground">{p.required ? 'yes' : 'no'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <dl className="mt-4 space-y-1 text-sm">
        {path && (
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-muted-foreground">Computation file</dt>
            <dd className="inline-flex items-center gap-1 font-mono text-xs break-all">
              <FileCode className="size-3.5 shrink-0" />
              {path}
            </dd>
          </div>
        )}
        {executor?.resource && (
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-muted-foreground">Executor</dt>
            <dd className="font-mono text-xs break-all">{executor.resource}</dd>
          </div>
        )}
        {executor && executor.receipt.length > 0 && (
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-muted-foreground">Receipt fields</dt>
            <dd className="font-mono text-xs break-all">{executor.receipt.join(', ')}</dd>
          </div>
        )}
        {attester?.resource && (
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-muted-foreground">Attester</dt>
            <dd className="font-mono text-xs break-all">{attester.resource}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}
