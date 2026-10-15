import { services } from "@/content/services";

export const serviceOptions: readonly string[] = [...services.map((s) => s.title), "Not sure yet"];
