import type { Product } from "@/lib/types";

export const restaurant = {
  name: "Imperio",
  descriptor: "Cocina de barrio",
  address: "Av. Orquídeas, Hacienda Coacalco"
};

const breakfastHours = {
  availableFrom: "09:00",
  availableUntil: "17:00"
};

const lunchHours = {
  availableFrom: "13:00",
  availableUntil: "17:00"
};

const breakfastPackage = ["Fruta de temporada", "Café de la casa"];
const salsaGroup = {
  id: "salsa",
  label: "Elige tu salsa",
  choices: ["Salsa verde", "Salsa roja", "Salsa suiza"],
  required: true
};
const cheeseGroup = {
  id: "queso",
  label: "Elige el terminado",
  choices: ["Queso fresco", "Manchego gratinado"],
  required: true
};
const eggGroup = {
  id: "huevos",
  label: "¿Cómo quieres tus huevos?",
  choices: ["Revueltos", "Estrellados", "A la mexicana"],
  required: true
};

export const products: Product[] = [
  {
    id: "chilaquiles-sencillos",
    name: "Chilaquiles sencillos",
    description: "Totopos con crema y cebolla. Paquete con fruta y café.",
    price: 60,
    category: "Desayunos",
    image: "/menu/imperio/chilaquiles-sencillos.jpg",
    popular: true,
    optionGroups: [salsaGroup, cheeseGroup],
    packageIncludes: breakfastPackage,
    ...breakfastHours
  },
  {
    id: "huevos-al-gusto",
    name: "Huevos al gusto",
    description: "Dos huevos con frijoles refritos. Paquete con fruta y café.",
    price: 60,
    category: "Desayunos",
    image: "/menu/imperio/huevos-al-gusto.jpg",
    optionGroups: [eggGroup],
    packageIncludes: breakfastPackage,
    ...breakfastHours
  },
  {
    id: "chilaquiles-huevo",
    name: "Chilaquiles con 1 huevo",
    description: "Chilaquiles con un huevo al gusto. Paquete con fruta y café.",
    price: 65,
    category: "Desayunos",
    image: "/menu/imperio/chilaquiles-huevo.jpg",
    optionGroups: [salsaGroup, cheeseGroup, eggGroup],
    packageIncludes: breakfastPackage,
    ...breakfastHours
  },
  {
    id: "molletes",
    name: "Molletes tradicionales",
    description: "Pan con frijoles, tocino y chorizo. Paquete con fruta y café.",
    price: 70,
    category: "Desayunos",
    image: "/menu/imperio/molletes.jpg",
    popular: true,
    optionGroups: [cheeseGroup],
    packageIncludes: breakfastPackage,
    ...breakfastHours
  },
  {
    id: "molletes-champinones",
    name: "Molletes de champiñones",
    description: "Pan con frijoles y champiñones salteados. Paquete con fruta y café.",
    price: 80,
    category: "Desayunos",
    image: "/menu/imperio/molletes.jpg",
    isNew: true,
    optionGroups: [cheeseGroup],
    packageIncludes: breakfastPackage,
    ...breakfastHours
  },
  {
    id: "enchiladas-verdes",
    name: "Enchiladas verdes",
    description: "Tres piezas rellenas de pollo. Paquete con fruta y café.",
    price: 85,
    category: "Desayunos",
    image: "/menu/imperio/enchiladas-suizas.jpg",
    optionGroups: [salsaGroup, cheeseGroup],
    packageIncludes: breakfastPackage,
    ...breakfastHours
  },
  {
    id: "enfrijoladas",
    name: "Enfrijoladas veracruzanas",
    description: "Rellenas de pollo, cubiertas con frijol y chorizo. Incluye fruta y café.",
    price: 85,
    category: "Desayunos",
    image: "/menu/imperio/enfrijoladas.jpg",
    popular: true,
    optionGroups: [cheeseGroup],
    packageIncludes: breakfastPackage,
    ...breakfastHours
  },
  {
    id: "chilaquiles-carne",
    name: "Chilaquiles con carne asada",
    description: "Chilaquiles con carne asada. Paquete con fruta y café.",
    price: 85,
    category: "Desayunos",
    image: "/menu/imperio/chilaquiles-huevo.jpg",
    optionGroups: [salsaGroup, cheeseGroup],
    packageIncludes: breakfastPackage,
    ...breakfastHours
  },
  {
    id: "chilaquiles-pechuga",
    name: "Chilaquiles con pechuga empanizada",
    description: "Chilaquiles con pechuga empanizada. Paquete con fruta y café.",
    price: 90,
    category: "Desayunos",
    image: "/menu/imperio/chilaquiles-pechuga.jpg",
    popular: true,
    optionGroups: [salsaGroup, cheeseGroup],
    packageIncludes: breakfastPackage,
    ...breakfastHours
  },
  {
    id: "enchiladas-suizas",
    name: "Enchiladas suizas",
    description: "Rellenas de pollo y gratinadas con manchego. Incluye fruta y café.",
    price: 90,
    category: "Desayunos",
    image: "/menu/imperio/enchiladas-suizas.jpg",
    popular: true,
    packageIncludes: breakfastPackage,
    ...breakfastHours
  },
  {
    id: "enmoladas",
    name: "Enmoladas",
    description: "Cuatro enchiladas rellenas de pollo y bañadas en mole. Incluye fruta y café.",
    price: 90,
    category: "Desayunos",
    image: "/menu/imperio/enmoladas.jpg",
    packageIncludes: breakfastPackage,
    ...breakfastHours
  },
  {
    id: "chilaquiles-suizos",
    name: "Chilaquiles suizos",
    description: "Con pechuga, salsa suiza y manchego gratinado. Incluye fruta y café.",
    price: 90,
    category: "Desayunos",
    image: "/menu/imperio/chilaquiles-sencillos.jpg",
    packageIncludes: breakfastPackage,
    ...breakfastHours
  },
  {
    id: "chilaquiles-divorciados",
    name: "Chilaquiles divorciados",
    description: "Dos huevos con salsa verde y roja. Paquete con fruta y café.",
    price: 90,
    category: "Desayunos",
    image: "/menu/imperio/chilaquiles-huevo.jpg",
    optionGroups: [eggGroup, cheeseGroup],
    packageIncludes: breakfastPackage,
    ...breakfastHours
  },
  {
    id: "arrachera-desayuno",
    name: "200 g de arrachera",
    description: "Acompañada de papas fritas, ensalada y frijoles.",
    price: 90,
    category: "Desayunos",
    image: "/menu/imperio/arrachera.jpg",
    ...breakfastHours
  },
  {
    id: "omelette-champinones",
    name: "Omelette de champiñones",
    description: "Relleno de queso y jamón con frijoles. Paquete con fruta y café.",
    price: 65,
    category: "Desayunos",
    image: "/menu/imperio/omelette-champinones.jpg",
    optionGroups: [cheeseGroup],
    packageIncludes: breakfastPackage,
    ...breakfastHours
  },
  {
    id: "taco-bistec-longaniza",
    name: "Taco de bistec o longaniza",
    description: "Taco servido con una porción de papas fritas.",
    price: 26,
    category: "A la carta",
    image: "/menu/imperio/taco-bistec.jpg",
    options: ["Bistec", "Longaniza"],
    ...breakfastHours
  },
  {
    id: "papas-francesa",
    name: "Orden de papas a la francesa",
    description: "Papas doradas preparadas al momento.",
    price: 45,
    category: "A la carta",
    image: "/menu/imperio/papas-francesas.jpg",
    ...breakfastHours
  },
  {
    id: "ensalada-fresca",
    name: "Ensalada fresca",
    description: "Con pollo o atún, rollitos de jamón, queso y vegetales frescos.",
    price: 65,
    category: "A la carta",
    image: "/menu/imperio/ensalada.jpg",
    options: ["Pollo", "Atún"],
    ...breakfastHours
  },
  {
    id: "club-sandwich",
    name: "Club sándwich",
    description: "Sándwich de dos pisos con pollo, tocino, jamón, queso y verduras; incluye papas.",
    price: 65,
    category: "A la carta",
    image: "/menu/imperio/club-sandwich.jpg",
    popular: true,
    ...breakfastHours
  },
  {
    id: "desayuno-combinado",
    name: "Desayuno combinado",
    description: "Dos hot cakes, dos huevos, dos piezas de tocino y una porción de fruta.",
    price: 65,
    category: "A la carta",
    image: "/menu/imperio/hotcakes-waffles.jpg",
    ...breakfastHours
  },
  {
    id: "bisquet",
    name: "Bisquet horneado",
    description: "Servido con mantequilla y mermelada de fresa.",
    price: 25,
    category: "Panes y más",
    image: "/menu/imperio/bisquet.jpg",
    ...breakfastHours
  },
  {
    id: "pan-frances",
    name: "Pan francés",
    description: "Orden de tres piezas preparada al momento.",
    price: 40,
    category: "Panes y más",
    image: "/menu/imperio/pan-frances.jpg",
    ...breakfastHours
  },
  {
    id: "hot-cakes",
    name: "Hot cakes",
    description: "Orden de tres piezas.",
    price: 40,
    category: "Panes y más",
    image: "/menu/imperio/hotcakes-waffles.jpg",
    ...breakfastHours
  },
  {
    id: "waffles",
    name: "Waffles",
    description: "Dos piezas servidas con helado y fruta de temporada.",
    price: 45,
    category: "Panes y más",
    image: "/menu/imperio/hotcakes-waffles.jpg",
    ...breakfastHours
  },
  {
    id: "cuernito",
    name: "Cuernito horneado",
    description: "Con jamón, quesos, lechuga y jitomate.",
    price: 35,
    category: "Panes y más",
    image: "/menu/imperio/cuernito.jpg",
    ...breakfastHours
  },
  {
    id: "coca-cola",
    name: "Coca-Cola 355 ml",
    description: "Refresco frío en presentación de 355 ml.",
    price: 28,
    category: "Bebidas",
    image: "/menu/imperio/refresco-cola.jpg",
    ...breakfastHours
  },
  {
    id: "licuado",
    name: "Licuado",
    description: "Preparado con leche y fruta.",
    price: 30,
    category: "Bebidas",
    image: "/menu/imperio/malteada-fresa.jpg",
    options: ["Plátano", "Fresa", "Mamey"],
    ...breakfastHours
  },
  {
    id: "cafe-leche",
    name: "Café con leche evaporada",
    description: "Café caliente preparado al momento.",
    price: 25,
    category: "Bebidas",
    image: "/menu/imperio/cafe-leche.jpg",
    ...breakfastHours
  },
  {
    id: "malteada",
    name: "Malteada",
    description: "Cremosa malteada fría.",
    price: 40,
    category: "Bebidas",
    image: "/menu/imperio/malteada-fresa.jpg",
    options: ["Fresa", "Chocolate", "Vainilla"],
    ...breakfastHours
  },
  {
    id: "jugo-verde",
    name: "Jugo verde",
    description: "Jugo de piña, espinaca y apio, 500 ml.",
    price: 35,
    category: "Bebidas",
    image: "/menu/imperio/jugo-verde.jpg",
    ...breakfastHours
  },
  {
    id: "agua-fruta",
    name: "Agua de fruta",
    description: "Agua fresca preparada con el sabor disponible del día.",
    price: 25,
    category: "Bebidas",
    image: "/menu/imperio/agua-fruta.jpg",
    ...breakfastHours
  },
  {
    id: "pechuga-empanizada",
    name: "Pechuga de pollo empanizada",
    description: "Acompañada de ensalada y frijoles.",
    price: 85,
    category: "Comidas a la carta",
    image: "/menu/imperio/pollo-empanizado.jpg",
    ...lunchHours
  },
  {
    id: "pechuga-plancha",
    name: "Pechuga de pollo a la plancha",
    description: "Acompañada de ensalada y frijoles.",
    price: 85,
    category: "Comidas a la carta",
    image: "/menu/imperio/pollo-plancha.jpg",
    ...lunchHours
  },
  {
    id: "milanesa-res",
    name: "Milanesa de res",
    description: "Acompañada de ensalada y frijoles.",
    price: 85,
    category: "Comidas a la carta",
    image: "/menu/imperio/milanesa-res.jpg",
    ...lunchHours
  },
  {
    id: "pechuga-rellena",
    name: "Pechuga de pollo rellena",
    description: "Con jamón y quesos, acompañada de papas fritas y ensalada.",
    price: 95,
    category: "Comidas a la carta",
    image: "/menu/imperio/pechuga-rellena.jpg",
    popular: true,
    ...lunchHours
  },
  {
    id: "filete-pescado",
    name: "Filete de pescado empanizado",
    description: "Acompañado de papas fritas y ensalada.",
    price: 95,
    category: "Comidas a la carta",
    image: "/menu/imperio/pescado-empanizado.jpg",
    ...lunchHours
  },
  {
    id: "enchiladas-suizas-comida",
    name: "Enchiladas suizas de comida",
    description: "Rellenas de queso Oaxaca, cubiertas con pollo y gratinadas con manchego.",
    price: 100,
    category: "Comidas a la carta",
    image: "/menu/imperio/enchiladas-suizas.jpg",
    ...lunchHours
  },
  {
    id: "arrachera-comida",
    name: "200 g de arrachera",
    description: "Acompañada de papas a la francesa, ensalada y frijoles.",
    price: 100,
    category: "Comidas a la carta",
    image: "/menu/imperio/arrachera.jpg",
    ...lunchHours
  },
  {
    id: "enchiladas-mole-comida",
    name: "Enchiladas de mole",
    description: "Cuatro piezas rellenas de pollo y bañadas en mole tradicional.",
    price: 100,
    category: "Comidas a la carta",
    image: "/menu/imperio/enmoladas.jpg",
    ...lunchHours
  }
];

export const categories = [
  "Favoritos",
  "Desayunos",
  "A la carta",
  "Panes y más",
  "Bebidas",
  "Comidas a la carta"
];

export const activeTables = ["A1", "A2", "A3", "B1", "B2", "B3"];

export const money = (value: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: value % 1 ? 2 : 0
  }).format(value);

export function mexicoCityMinutes(date = new Date()) {
  const parts = new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);
  return hour * 60 + minute;
}

export function timeToMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function isProductAvailable(product: Product, currentMinutes: number | null) {
  if (currentMinutes === null || !product.availableFrom || !product.availableUntil) return true;
  return (
    currentMinutes >= timeToMinutes(product.availableFrom) &&
    currentMinutes < timeToMinutes(product.availableUntil)
  );
}
