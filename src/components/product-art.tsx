import Image from "next/image";
import type { Product } from "@/src/data/catalog";

const artByCategory: Record<Product["category"], string> = {
  Laptops: "/art/laptops.webp",
  Audio: "/art/audio.webp",
  Phones: "/art/phones.webp",
  Gaming: "/art/gaming.webp",
  Cameras: "/art/cameras.webp",
  Accessories: "/art/accessories.webp",
};

const artByProduct: Record<string, string> = {
  "gam-002": "/art/monitor-wide.png",
};

export function ProductArt({ product, preload = false, sizes = "(max-width: 480px) 45vw, (max-width: 760px) 46vw, (max-width: 1100px) 30vw, 320px" }: { product: Product; preload?: boolean; sizes?: string }) {
  const offset = ((product.imageVariant - 1) % 4) * 2;
  return (
    <div
      className={"product-art" + (artByProduct[product.id] ? " product-art-specific" : "")}
      style={{
        "--accent": product.accent,
        "--art-x": `${48 + offset}%`,
        "--art-scale": `${1.02 + (product.imageVariant % 3) * 0.04}`,
      } as React.CSSProperties}
    >
      <Image
        src={artByProduct[product.id] ?? artByCategory[product.category]}
        alt={`${product.brand} ${product.name}`}
        fill
        sizes={sizes}
        preload={preload}
      />
    </div>
  );
}

