import { ReactNode } from "react";
import { Card, CardContent } from "./ui/card";

export interface DataTableColumn<T> {
  id: string;
  label: string;
  render?: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  title?: string;
  description?: string;
  columns: DataTableColumn<T>[];
  data: T[];
  emptyState?: ReactNode;
}

export function DataTable<T>({
  columns,
  data,
  emptyState,
}: DataTableProps<T>) {
  return (
    <Card className="overflow-hidden border-border/60">
      <CardContent className="p-0">
        <table className="min-w-full divide-y divide-border/60">
          <thead className="bg-background/60">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.id}
                  className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground px-4 py-3"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {data.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-sm text-muted-foreground" colSpan={columns.length}>
                  {emptyState ?? "No records available yet."}
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-background/40">
                  {columns.map((column) => (
                    <td key={column.id} className="px-4 py-3 text-sm">
                      {column.render ? column.render(row) : (row as any)[column.id]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
