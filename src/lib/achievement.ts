export const JUARA_OPTIONS = [
  { value: "JUARA_I", label: "Juara I" },
  { value: "JUARA_II", label: "Juara II" },
  { value: "JUARA_III", label: "Juara III" },
  { value: "JUARA_HARAPAN", label: "Juara Harapan" },
] as const;

export const JUARA_LABELS: Record<string, string> = {
  JUARA_I: "Juara I",
  JUARA_II: "Juara II",
  JUARA_III: "Juara III",
  JUARA_HARAPAN: "Juara Harapan",
};

export const LEVEL_OPTIONS = [
  "Internasional",
  "Nasional",
  "Provinsi",
  "Kabupaten/Kota",
  "Universitas",
  "Fakultas",
];

export const CATEGORY_OPTIONS = [
  "Akademik",
  "Olahraga",
  "Seni",
  "Penelitian",
  "Teknologi",
  "Sosial",
  "Lainnya",
];
