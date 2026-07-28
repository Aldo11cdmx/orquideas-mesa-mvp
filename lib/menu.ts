import type { Product } from "@/lib/types";

export const restaurant = {
  name: "Orquídeas",
  descriptor: "Cocina de barrio",
  address: "Av. Orquídeas, Hacienda Coacalco",
  identityNote: "Nombre provisional hasta confirmar el nombre comercial"
};

const sauces = [
  "Clásica",
  "BBQ tradicional",
  "Ajo parmesano",
  "Búfalo",
  "Tamarindo jalapeño",
  "Crema chipotle"
];

export const products: Product[] = [
  {
    id: "texas",
    name: "Hamburguesa Texas Burger",
    description:
      "Pan artesanal, jamón, abundante tocino, aros de cebolla, queso manchego y Oaxaca, catsup, mayonesa, mostaza y BBQ.",
    price: 75,
    compareAt: 120,
    category: "Mega hamburguesas",
    image: "/menu/texas.png",
    popular: true
  },
  {
    id: "sencilla",
    name: "Hamburguesa Sencilla",
    description: "200 g de carne preparada, queso, vegetales frescos y papas.",
    price: 110,
    category: "Mega hamburguesas",
    image: "/menu/texas.png"
  },
  {
    id: "noctec",
    name: "Hamburguesa Noctec Burger",
    description: "Chorizo, jamón y quesos, acompañada de papas.",
    price: 125,
    category: "Mega hamburguesas",
    image: "/menu/texas.png",
    isNew: true
  },
  {
    id: "hawaiana",
    name: "Hamburguesa Hawaiana",
    description: "Jamón, piña y quesos con papas a la francesa.",
    price: 125,
    category: "Mega hamburguesas",
    image: "/menu/texas.png"
  },
  {
    id: "suiza",
    name: "Hamburguesa Suiza",
    description: "Jamón, quesillo, queso amarillo y vegetales.",
    price: 125,
    category: "Mega hamburguesas",
    image: "/menu/texas.png"
  },
  {
    id: "bufalo-burger",
    name: "Búfalo Chicken Burger",
    description: "Pechuga de pollo rebozada, salsa búfalo y papas.",
    price: 125,
    category: "Mega hamburguesas",
    image: "/menu/boneless.png"
  },
  {
    id: "hongo",
    name: "Hongo Burger",
    description: "200 g de carne sobre champiñones, queso y vegetales.",
    price: 130,
    category: "Mega hamburguesas",
    image: "/menu/texas.png"
  },
  {
    id: "monster",
    name: "Monster Burger",
    description: "Doble carne, jamón, tocino, quesos y papas.",
    price: 175,
    category: "Mega hamburguesas",
    image: "/menu/texas.png",
    popular: true
  },
  {
    id: "chipotle",
    name: "Chipotle Burger",
    description: "Queso crema y aderezo chipotle con papas.",
    price: 130,
    category: "Mega hamburguesas",
    image: "/menu/texas.png"
  },
  {
    id: "boneless",
    name: "Boneless",
    description: "Crujientes trozos de pollo bañados con salsa de tu elección.",
    price: 67.5,
    compareAt: 110,
    category: "Para compartir",
    image: "/menu/boneless.png",
    popular: true,
    options: sauces
  },
  {
    id: "alitas",
    name: "Alitas",
    description: "Fritas, bañadas con salsa de tu elección y acompañadas de papas fritas.",
    price: 67.5,
    compareAt: 110,
    category: "Para compartir",
    image: "/menu/alitas.png",
    popular: true,
    options: sauces.filter((s) => s !== "Búfalo")
  },
  {
    id: "ensalada-imperial",
    name: "Ensalada Imperial",
    description:
      "Pechuga rebozada sobre lechuga con zanahoria, champiñones, piña, queso manchego y aderezo ranch.",
    price: 100,
    category: "Para compartir",
    image: "/menu/ensalada.png"
  },
  {
    id: "nachos",
    name: "Nachos Chilli",
    description:
      "Carne, chorizo y frijoles al chipotle, gratinados con queso, catsup y jalapeños.",
    price: 85,
    category: "Para compartir",
    image: "/menu/nachos.png"
  },
  {
    id: "poutine",
    name: "Poutine",
    description: "Arrachera servida sobre papas a la francesa con queso y salsa.",
    price: 115,
    category: "Para compartir",
    image: "/menu/texas.png",
    soldOut: true
  },
  {
    id: "club",
    name: "Club Sándwich",
    description:
      "Sándwich de 3 pisos relleno de jamón, pollo, tocino, quesos, lechuga y jitomate; acompañado de papas.",
    price: 90,
    category: "Para compartir",
    image: "/menu/club.png"
  },
  {
    id: "papas",
    name: "Papas Fritas",
    description: "300 gramos de papas a la francesa.",
    price: 65,
    category: "Para compartir",
    image: "/menu/alitas.png"
  },
  {
    id: "chilaquiles",
    name: "Chilaquiles",
    description: "Costilla de res asada servida con chilaquiles.",
    price: 80,
    category: "Antojitos mexicanos",
    image: "/menu/nachos.png"
  },
  {
    id: "carnita",
    name: "Carnita Asada",
    description: "Jugosa arrachera con papas y ensalada.",
    price: 105,
    category: "Antojitos mexicanos",
    image: "/menu/ensalada.png"
  },
  ...[
    ["bistec", "Mega Burro Bistec", "Bistec"],
    ["campechano", "Mega Burro Campechano", "bistec con longaniza"],
    ["pollo", "Mega Burro Pollo", "pollo"],
    ["pastor", "Mega Burro Pastor", "carne al pastor"],
    ["texano", "Mega Burro Texano", "bistec, tocino y BBQ"]
  ].map(([id, name, filling]) => ({
    id: `burro-${id}`,
    name,
    description: `Tortilla de harina de 35 cm con mayonesa, frijoles, queso y ${filling}; acompañada de ensalada y papas.`,
    price: 95,
    category: "Mega burros",
    image: "/menu/burro.png",
    popular: id === "bistec" || id === "texano"
  })),
  {
    id: "combo-nachos",
    name: "Texas Burger + Nachos Chilli",
    description: "Hamburguesa Texas Burger con una orden de Nachos Chilli.",
    price: 156,
    compareAt: 195,
    category: "Combos",
    image: "/menu/texas.png"
  },
  {
    id: "combo-alitas",
    name: "Texas Burger + Alitas",
    description: "Hamburguesa Texas Burger con una orden de alitas.",
    price: 169,
    compareAt: 230,
    category: "Combos",
    image: "/menu/texas.png",
    options: sauces
  },
  {
    id: "combo-boneless",
    name: "Texas Burger + Boneless",
    description: "Hamburguesa Texas Burger con una orden de boneless.",
    price: 169,
    compareAt: 230,
    category: "Combos",
    image: "/menu/texas.png",
    options: sauces
  }
];

export const categories = [
  "Populares",
  "Mega hamburguesas",
  "Para compartir",
  "Antojitos mexicanos",
  "Mega burros",
  "Combos"
];

export const activeTables = ["A1", "A2", "A3", "B1", "B2", "B3"];

export const money = (value: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: value % 1 ? 2 : 0
  }).format(value);
