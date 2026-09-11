import type { Product, ProductExtra, ProductOptionGroup } from "@/lib/types";

export const restaurant = {
  name: "Imperio",
  descriptor: "Cocina de barrio",
  address: "Av. Orquídeas, Hacienda Coacalco"
};

const breakfastHours = {
  availableFrom: "09:00",
  availableUntil: "13:00"
};

const lunchHours = {
  availableFrom: "13:00",
  availableUntil: "17:00"
};

const allDayHours = {
  availableFrom: "09:00",
  availableUntil: "17:00"
};

const breakfastPackage = ["Fruta de temporada", "Café de la casa"];
const cartaExtras: ProductExtra[] = [
  { name: "Café", price: 15, active: true },
  { name: "Fruta extra", price: 10, active: true }
];

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

const comboEggGroup = {
  id: "huevos",
  label: "¿Cómo quieres tus huevos?",
  choices: ["Revueltos", "Estrellados"],
  required: true
};
const chickenStyleGroup = {
  id: "pechuga",
  label: "Elige tu pechuga",
  choices: ["Asada", "Empanizada"],
  required: true
};

const firstCourseGroup = {
  id: "primer-tiempo",
  label: "Primer tiempo",
  choices: ["Consomé", "Sopa"],
  required: true
};
const sideGroup = {
  id: "acompanamiento",
  label: "Acompañamiento",
  choices: ["Arroz", "Pasta"],
  required: true
};
const drinkGroup = {
  id: "agua",
  label: "Agua",
  choices: ["Agua de fruta", "Agua simple"],
  required: true
};

const cafeTypeGroup: ProductOptionGroup = {
  id: "cafe-tipo",
  label: "Tipo de café",
  choices: ["Café normal", "Café con leche evaporada"],
  choicePrices: [0, 15],
  required: true
};


export const products: Product[] = [
  {
    id: "chilaquiles-sencillos",
    slug: "chilaquiles-sencillos",
    name: "Chilaquiles sencillos",
    description: "Totopos con crema y cebolla. Paquete con fruta y café.",
    price: 50,
    category: "Desayunos",
    image: "/menu/imperio/chilaquiles-sencillos.jpg",
    popular: true,
    packageIncludes: breakfastPackage,
    ...breakfastHours
  },
  {
    id: "huevos-al-gusto",
    slug: "huevos-al-gusto",
    name: "Huevos al gusto",
    description: "Dos huevos con frijoles refritos. Paquete con fruta y café.",
    price: 60,
    category: "Desayunos",
    image: "/menu/imperio/huevos-al-gusto-nuevos.jpg",
    optionGroups: [eggGroup],
    packageIncludes: breakfastPackage,
    ...breakfastHours
  },
  {
    id: "chilaquiles-huevo",
    slug: "chilaquiles-huevo",
    name: "Chilaquiles con 1 huevo",
    description: "Chilaquiles con un huevo al gusto. Paquete con fruta y café.",
    price: 60,
    category: "Desayunos",
    image: "/menu/imperio/chilaquiles-huevo.jpg",
    optionGroups: [eggGroup],
    packageIncludes: breakfastPackage,
    ...breakfastHours
  },
  {
    id: "molletes",
    slug: "molletes",
    name: "Molletes tradicionales",
    description: "Pan con frijoles, tocino y chorizo. Paquete con fruta y café.",
    price: 65,
    category: "Desayunos",
    image: "/menu/imperio/molletes.jpg",
    popular: true,
    packageIncludes: breakfastPackage,
    ...breakfastHours
  },
  {
    id: "enchiladas-verdes",
    slug: "enchiladas-verdes",
    name: "Enchiladas verdes",
    description: "Tres piezas rellenas de pollo. Paquete con fruta y café.",
    price: 70,
    category: "Desayunos",
    image: "/menu/imperio/enchiladas-verdes-nuevas.jpg",
    packageIncludes: breakfastPackage,
    ...breakfastHours
  },
  {
    id: "enfrijoladas",
    slug: "enfrijoladas",
    name: "Enfrijoladas veracruzanas",
    description: "Rellenas de pollo, cubiertas con frijol y chorizo. Incluye fruta y café.",
    price: 85,
    category: "Desayunos",
    image: "/menu/imperio/enfrijoladas.jpg",
    popular: true,
    packageIncludes: breakfastPackage,
    ...breakfastHours
  },
  {
    id: "chilaquiles-carne",
    slug: "chilaquiles-carne",
    name: "Chilaquiles con carne asada",
    description: "Chilaquiles con carne asada. Paquete con fruta y café.",
    price: 85,
    category: "Desayunos",
    image: "/menu/imperio/chilaquiles-carne.jpg",
    packageIncludes: breakfastPackage,
    ...breakfastHours
  },
  {
    id: "chilaquiles-pechuga",
    slug: "chilaquiles-pechuga",
    name: "Chilaquiles con pechuga",
    description: "Chilaquiles con pechuga de pollo. Paquete con fruta y café.",
    price: 85,
    category: "Desayunos",
    image: "/menu/imperio/chilaquiles-pechuga.jpg",
    popular: true,
    optionGroups: [chickenStyleGroup],
    packageIncludes: breakfastPackage,
    ...breakfastHours
  },
  {
    id: "enchiladas-suizas",
    slug: "enchiladas-suizas",
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
    slug: "enmoladas",
    name: "Enmoladas",
    description: "Cuatro enchiladas rellenas de pollo y bañadas en mole. Incluye fruta y café.",
    price: 90,
    category: "Desayunos",
    image: "/menu/imperio/enmoladas.jpg",
    packageIncludes: breakfastPackage,
    ...breakfastHours
  },
  {
    id: "chilaquiles-divorciados",
    slug: "chilaquiles-divorciados",
    name: "Chilaquiles divorciados",
    description: "Dos huevos con salsa verde y roja. Paquete con fruta y café.",
    price: 90,
    category: "Desayunos",
    image: "/menu/imperio/chilaquiles-divorciados.jpg",
    optionGroups: [eggGroup],
    packageIncludes: breakfastPackage,
    ...breakfastHours
  },
  {
    id: "chilaquiles-suizos",
    slug: "chilaquiles-suizos",
    name: "Chilaquiles suizos",
    description: "Servidos con fajitas de pechuga, queso manchego gratinado y bañados en nuestra salsa suiza.",
    price: 90,
    category: "Desayunos",
    image: "/menu/imperio/chilaquiles-suizos.jpg",
    popular: true,
    packageIncludes: breakfastPackage,
    ...breakfastHours
  },
  {
    id: "desayuno-infantil",
    slug: "desayuno-infantil",
    name: "Desayuno infantil",
    description: "5 mini hot cakes, licuado a elegir y una porción de fruta.",
    price: 75,
    category: "Desayunos",
    image: "/menu/imperio/desayuno-infantil.jpg",
    optionGroups: [
      {
        id: "licuado",
        label: "Elige tu licuado",
        choices: ["Plátano", "Fresa", "Mamey"],
        required: true
      }
    ],
    packageIncludes: ["Fruta de temporada"],
    ...breakfastHours
  },
  {
    id: "arrachera-desayuno",
    slug: "arrachera-desayuno",
    name: "200 g de arrachera",
    description: "Acompañada de papas fritas, ensalada y frijoles.",
    price: 90,
    category: "Desayunos",
    image: "/menu/imperio/arrachera-actual.jpg",
    extrasConfig: cartaExtras,
    ...breakfastHours
  },
  {
    id: "omelette-champinones",
    slug: "omelette-champinones",
    name: "Omelette de champiñones",
    description: "Omelette de champiñones con frijoles. Paquete con fruta y café.",
    price: 65,
    category: "Desayunos",
    image: "/menu/imperio/omelette-champinones.jpg",
    optionGroups: [salsaGroup, cheeseGroup],
    packageIncludes: breakfastPackage,
    ...breakfastHours
  },
  {
    id: "taco-bistec-longaniza",
    slug: "taco-bistec-longaniza",
    name: "Taco de bistec o longaniza",
    description: "Taco servido con una porción de papas fritas.",
    price: 26,
    category: "A la carta",
    image: "/menu/imperio/taco-bistec.jpg",
    optionGroups: [
      {
        id: "carne",
        label: "Elige tu carne",
        choices: ["Bistec", "Longaniza"],
        required: true
      }
    ],
    extrasConfig: cartaExtras,
    ...allDayHours
  },
  {
    id: "papas-francesa",
    slug: "papas-francesa",
    name: "Orden de papas a la francesa",
    description: "Papas doradas preparadas al momento.",
    price: 45,
    category: "A la carta",
    image: "/menu/imperio/papas-francesas.jpg",
    extrasConfig: cartaExtras,
    ...allDayHours
  },
  {
    id: "ensalada-fresca",
    slug: "ensalada-fresca",
    name: "Ensalada fresca",
    description: "Con pollo o atún, rollitos de jamón, queso y vegetales frescos.",
    price: 65,
    category: "A la carta",
    image: "/menu/imperio/ensalada.jpg",
    options: ["Pollo", "Atún"],
    extrasConfig: cartaExtras,
    ...allDayHours
  },
  {
    id: "club-sandwich",
    slug: "club-sandwich",
    name: "Club sándwich",
    description: "Sándwich de dos pisos con pollo, tocino, jamón, queso y verduras; incluye papas.",
    price: 65,
    category: "A la carta",
    image: "/menu/imperio/club-sandwich.jpg",
    popular: true,
    extrasConfig: cartaExtras,
    ...allDayHours
  },
  {
    id: "desayuno-combinado",
    slug: "desayuno-combinado",
    name: "Desayuno combinado",
    description: "2 hot cakes, 2 huevos, 2 piezas de tocino y 1 porción de fruta.",
    price: 65,
    category: "A la carta",
    image: "/menu/imperio/desayuno-combinado.jpg",
    optionGroups: [comboEggGroup],
    ...breakfastHours
  },
  {
    id: "bisquet",
    slug: "bisquet",
    name: "Bisquet horneado",
    description: "Servido con mantequilla y mermelada de fresa.",
    price: 25,
    category: "Panes y más",
    image: "/menu/imperio/bisquet-nuevo.jpg",
    extrasConfig: cartaExtras,
    ...breakfastHours
  },
  {
    id: "pan-frances",
    slug: "pan-frances",
    name: "Pan francés",
    description: "Orden de tres piezas preparada al momento.",
    price: 40,
    category: "Panes y más",
    image: "/menu/imperio/pan-frances.jpg",
    extrasConfig: cartaExtras,
    ...breakfastHours
  },
  {
    id: "hot-cakes",
    slug: "hot-cakes",
    name: "Hot cakes",
    description: "Orden de tres piezas.",
    price: 40,
    category: "Panes y más",
    image: "/menu/imperio/hot-cakes-nuevos.jpg",
    extrasConfig: cartaExtras,
    ...breakfastHours
  },
  {
    id: "waffles",
    slug: "waffles",
    name: "Waffles",
    description: "Dos piezas servidas con helado y fruta de temporada.",
    price: 45,
    category: "Panes y más",
    image: "/menu/imperio/waffles-nuevos.jpg",
    extrasConfig: cartaExtras,
    ...breakfastHours
  },
  {
    id: "cuernito",
    slug: "cuernito",
    name: "Cuernito horneado",
    description: "Con jamón, quesos, lechuga y jitomate.",
    price: 35,
    category: "Panes y más",
    image: "/menu/imperio/cuernito.jpg",
    extrasConfig: cartaExtras,
    ...breakfastHours
  },
  {
    id: "coca-cola",
    slug: "coca-cola",
    name: "Coca-Cola 500 ml",
    description: "Refresco frío en presentación de 500 ml.",
    price: 28,
    category: "Bebidas",
    image: "/menu/imperio/refresco-cola.jpg",
    ...allDayHours
  },
  {
    id: "licuado",
    slug: "licuado",
    name: "Licuado",
    description: "Preparado con leche y fruta.",
    price: 30,
    category: "Bebidas",
    image: "/menu/imperio/licuado.jpg",
    options: ["Plátano", "Fresa", "Mamey"],
    optionGroups: [
      {
        id: "sabor",
        label: "Elige tu sabor",
        choices: ["Plátano", "Fresa", "Mamey"],
        required: true
      }
    ],
    ...allDayHours
  },
  {
    id: "cafe",
    slug: "cafe",
    name: "Café",
    description: "Café caliente preparado al momento.",
    price: 15,
    category: "Bebidas",
    image: "/menu/imperio/cafe-leche.jpg",
    optionGroups: [cafeTypeGroup],
    ...allDayHours
  },
  {
    id: "te",
    slug: "te",
    name: "Té",
    description: "Té caliente preparado al momento.",
    price: 15,
    category: "Bebidas",
    image: "/menu/imperio/cafe-leche.jpg",
    ...allDayHours
  },
  {
    id: "malteada",
    slug: "malteada",
    name: "Malteada",
    description: "Cremosa malteada fría.",
    price: 40,
    category: "Bebidas",
    image: "/menu/imperio/malteada-fresa.jpg",
    options: ["Fresa", "Vainilla", "Chocolate", "Cajeta", "Nescafé"],
    optionGroups: [
      {
        id: "sabor",
        label: "Elige tu sabor",
        choices: ["Fresa", "Vainilla", "Chocolate", "Cajeta", "Nescafé"],
        required: true
      }
    ],
    ...allDayHours
  },
  {
    id: "jugo-verde",
    slug: "jugo-verde",
    name: "Jugo verde",
    description: "Jugo de piña, espinaca y apio, 500 ml.",
    price: 35,
    category: "Bebidas",
    image: "/menu/imperio/jugo-verde.jpg",
    ...allDayHours
  },
  {
    id: "agua-fruta",
    slug: "agua-fruta",
    name: "Agua de fruta",
    description: "Un litro de agua fresca con el sabor disponible del día.",
    price: 35,
    category: "Bebidas",
    image: "/menu/imperio/agua-fruta.jpg",
    ...allDayHours
  },
  {
    id: "enfrijoladas-carta",
    slug: "enfrijoladas-carta",
    name: "Enfrijoladas a la carta",
    description: "Rellenas de pollo, cubiertas con frijol, crema, queso y chorizo.",
    price: 90,
    category: "A la carta",
    image: "/menu/imperio/enfrijoladas.jpg",
    extrasConfig: cartaExtras,
    ...allDayHours
  },
  {
    id: "salchipulpos-papas",
    slug: "salchipulpos-papas",
    name: "Salchipulpos con papas",
    description: "Salchichas doradas en forma de pulpo acompañadas de papas a la francesa.",
    price: 65,
    category: "A la carta",
    image: "/menu/imperio/salchipulpos-papas.jpg",
    isNew: true,
    extrasConfig: cartaExtras,
    ...allDayHours
  },
  {
    id: "pechuga-empanizada",
    slug: "pechuga-empanizada",
    name: "Pechuga de pollo empanizada",
    description: "Acompañada de ensalada y frijoles.",
    price: 85,
    category: "Comidas a la carta",
    image: "/menu/imperio/pechuga-empanizada.jpg",
    extrasConfig: cartaExtras,
    ...lunchHours
  },
  {
    id: "pechuga-plancha",
    slug: "pechuga-plancha",
    name: "Pechuga de pollo a la plancha",
    description: "Acompañada de ensalada y frijoles.",
    price: 85,
    category: "Comidas a la carta",
    image: "/menu/imperio/pechuga-plancha.jpg",
    extrasConfig: cartaExtras,
    ...lunchHours
  },
  {
    id: "milanesa-res",
    slug: "milanesa-res",
    name: "Milanesa de res",
    description: "Acompañada de ensalada y frijoles.",
    price: 85,
    category: "Comidas a la carta",
    image: "/menu/imperio/milanesa-res.jpg",
    extrasConfig: cartaExtras,
    ...lunchHours
  },
  {
    id: "pechuga-rellena",
    slug: "pechuga-rellena",
    name: "Pechuga de pollo rellena",
    description: "Con jamón y quesos, acompañada de papas fritas y ensalada.",
    price: 95,
    category: "Comidas a la carta",
    image: "/menu/imperio/pechuga-rellena.jpg",
    popular: true,
    extrasConfig: cartaExtras,
    ...lunchHours
  },
  {
    id: "filete-pescado",
    slug: "filete-pescado",
    name: "Filete de pescado empanizado",
    description: "Acompañado de papas fritas y ensalada.",
    price: 95,
    category: "Comidas a la carta",
    image: "/menu/imperio/pescado-empanizado.jpg",
    extrasConfig: cartaExtras,
    ...lunchHours
  },
  {
    id: "enchiladas-suizas-comida",
    slug: "enchiladas-suizas-comida",
    name: "Enchiladas suizas de comida",
    description: "Rellenas de queso Oaxaca, cubiertas con pollo y gratinadas con manchego. Incluye ensalada.",
    price: 100,
    category: "Comidas a la carta",
    image: "/menu/imperio/enchiladas-suizas.jpg",
    optionGroups: [firstCourseGroup, sideGroup, drinkGroup],
    extrasConfig: cartaExtras
  },
  {
    id: "arrachera-comida",
    slug: "arrachera-comida",
    name: "200 g de arrachera",
    description: "Acompañada de papas a la francesa, ensalada y frijoles.",
    price: 100,
    category: "Comidas a la carta",
    image: "/menu/imperio/arrachera-actual.jpg",
    optionGroups: [firstCourseGroup, sideGroup, drinkGroup],
    extrasConfig: cartaExtras
  },
  {
    id: "enchiladas-mole-comida",
    slug: "enchiladas-mole-comida",
    name: "Enchiladas de mole",
    description: "Cuatro piezas rellenas de pollo y bañadas en mole tradicional. Incluye ensalada.",
    price: 100,
    category: "Comidas a la carta",
    image: "/menu/imperio/enmoladas.jpg",
    optionGroups: [firstCourseGroup, sideGroup, drinkGroup],
    extrasConfig: cartaExtras
  },
  {
    id: "enchiladas-verdes-comida",
    slug: "enchiladas-verdes-comida",
    name: "Enchiladas verdes",
    description: "Tres piezas rellenas de pollo.",
    price: 85,
    category: "Comidas a la carta",
    image: "/menu/imperio/enchiladas-verdes.jpg",
    optionGroups: [firstCourseGroup, sideGroup, drinkGroup],
    extrasConfig: cartaExtras
  },
  {
    id: "chilaquiles-suizos-comida",
    slug: "chilaquiles-suizos-comida",
    name: "Chilaquiles suizos",
    description: "Con fajitas de pechuga, queso manchego gratinado y bañados en nuestra salsa suiza.",
    price: 100,
    category: "Comidas a la carta",
    image: "/menu/imperio/chilaquiles-suizos.jpg",
    optionGroups: [firstCourseGroup, sideGroup, drinkGroup],
    extrasConfig: cartaExtras
  },
  {
    id: "extra-5",
    slug: "extra-5",
    name: "$5",
    description: "",
    price: 5,
    category: "Extras",
    image: "",
    ...allDayHours
  },
  {
    id: "extra-10",
    slug: "extra-10",
    name: "$10",
    description: "",
    price: 10,
    category: "Extras",
    image: "",
    ...allDayHours
  },
  {
    id: "extra-15",
    slug: "extra-15",
    name: "$15",
    description: "",
    price: 15,
    category: "Extras",
    image: "",
    ...allDayHours
  },
  {
    id: "extra-20",
    slug: "extra-20",
    name: "$20",
    description: "",
    price: 20,
    category: "Extras",
    image: "",
    ...allDayHours
  }
];

export const categories = [
  "Favoritos",
  "Desayunos",
  "A la carta",
  "Panes y más",
  "Bebidas",
  "Comidas a la carta",
  "Extras"
];

export const activeTables = ["A1", "A2", "A3", "B1", "B2", "B3", "LLEVAR"];

export const takeoutCode = "LLEVAR";

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

export function isProductAvailable(
  product: Product,
  currentMinutes: number | null,
  availableFrom?: string,
  availableUntil?: string
) {
  if (currentMinutes === null) return true;

  const effectiveFrom = availableFrom ?? product.availableFrom;
  const effectiveUntil = availableUntil ?? product.availableUntil;

  // Sin horario configurado = disponible todo el día.
  if (!effectiveFrom || !effectiveUntil) return true;

  const fromMinutes = timeToMinutes(effectiveFrom);
  const untilMinutes = timeToMinutes(effectiveUntil);

  return currentMinutes >= fromMinutes && currentMinutes < untilMinutes;
}
