import { z } from "zod";

const phoneRegex = /^(\+221\s?)?(7[05678]|3[03])\s?\d{3}\s?\d{2}\s?\d{2}$/;

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Saisissez votre adresse e-mail.").email("Adresse e-mail invalide."),
  password: z.string().min(1, "Saisissez votre mot de passe."),
});

export const registerSchema = z
  .object({
    first_name: z.string().trim().min(1, "Prénom requis.").max(80),
    last_name: z.string().trim().min(1, "Nom requis.").max(80),
    email: z.string().trim().email("Adresse e-mail invalide."),
    phone: z.string().trim().refine((v) => !v || phoneRegex.test(v), "Numéro sénégalais attendu, ex. +221 77 123 45 67.").optional(),
    role: z.enum(["CUSTOMER", "OWNER"]),
    password: z.string().min(8, "8 caractères minimum.").max(128).refine((v) => !/^\d+$/.test(v), "Le mot de passe ne peut pas être uniquement numérique."),
    confirm: z.string(),
    terms: z.literal(true, { error: "Vous devez accepter les conditions d'utilisation." }),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Les mots de passe ne correspondent pas." });

export const listingSchema = z
  .object({
    title: z.string().trim().min(5, "5 caractères minimum.").max(120),
    description: z.string().trim().min(20, "Décrivez le bien en 20 caractères minimum.").max(5000),
    property_type: z.enum(["APARTMENT", "HOUSE", "VILLA", "STUDIO", "ROOM", "LAND", "OFFICE"]),
    transaction_type: z.enum(["RENT", "SALE"]),
    price: z.coerce.number({ error: "Prix requis." }).int().min(1000, "Prix minimum : 1 000 FCFA."),
    surface_m2: z.union([z.literal(""), z.coerce.number().int().min(5).max(100000)]).optional(),
    rooms: z.coerce.number().int().min(1).max(50),
    bedrooms: z.coerce.number().int().min(0).max(50),
    bathrooms: z.coerce.number().int().min(0).max(50),
    is_furnished: z.boolean(),
    city: z.string().trim().min(2, "Ville requise.").max(80),
    district: z.string().trim().min(2, "Quartier requis.").max(80),
    address_public: z.string().trim().max(200).optional(),
    address_private: z.string().trim().max(200).optional(),
    latitude: z.union([z.literal(""), z.coerce.number().min(12).max(16.8, "Hors du Sénégal.")]).optional(),
    longitude: z.union([z.literal(""), z.coerce.number().min(-17.6).max(-11.3, "Hors du Sénégal.")]).optional(),
    amenities: z.array(z.string()),
  })
  .refine((d) => d.bedrooms <= d.rooms, { path: ["bedrooms"], message: "Pas plus de chambres que de pièces." })
  .refine((d) => (d.latitude === "" || d.latitude === undefined) === (d.longitude === "" || d.longitude === undefined), {
    path: ["longitude"],
    message: "Latitude et longitude vont ensemble.",
  });

export type ListingForm = z.input<typeof listingSchema>;
