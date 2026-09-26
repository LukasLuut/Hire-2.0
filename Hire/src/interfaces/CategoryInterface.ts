export interface Category {
    id: number;
    name: string;
    description: string;
    /** subcategorias sugeridas pela administração */
    subcategories?: string[] | null;
}