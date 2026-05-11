import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const mockProducts = [
  { id: "1", name: "Camiseta Oversized", price: "R$ 89,90", has3D: true },
  { id: "2", name: "Calça Cargo", price: "R$ 199,90", has3D: true },
  { id: "3", name: "Jaqueta Bomber", price: "R$ 349,90", has3D: false },
  { id: "4", name: "Moletom Básico", price: "R$ 159,90", has3D: true },
  { id: "5", name: "Vestido Midi", price: "R$ 229,90", has3D: false },
  { id: "6", name: "Bermuda Tactel", price: "R$ 99,90", has3D: true },
];

export default function CatalogoPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Catálogo</h1>
        <p className="text-zinc-600 dark:text-zinc-400">Explore as peças disponíveis</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {mockProducts.map((product) => (
          <Link key={product.id} href={`/produto/${product.id}`}>
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader className="aspect-square bg-zinc-100 dark:bg-zinc-900" />
              <CardContent className="pt-4">
                <CardTitle className="text-base">{product.name}</CardTitle>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm font-medium">{product.price}</span>
                  {product.has3D && (
                    <span className="rounded bg-zinc-900 px-2 py-0.5 text-xs text-white dark:bg-zinc-100 dark:text-zinc-900">
                      3D
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
