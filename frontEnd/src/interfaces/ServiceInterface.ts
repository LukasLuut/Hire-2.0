export interface Service {
    id: number;
    title: string;
    description_service: string;
    negotiable: boolean;
    price: string;
    duration: string;
    providerId?: number;
    categoryId?: number | null;
    subcategory?: string;
    requiresScheduling: boolean;
    /** atendimento online (sem visita) */
    online?: boolean;
    likesNumber?: number;
    imageUrl?: string;
    acceptedTerms?: boolean;
    cancellationNotice?: string;
    /** false = pausado */
    active?: boolean;
};

// "id": 28,
//     "title": "Titulo Servico",
//     "description_service": "subtitulo servico",
//     "negotiable": false,
//     "requiresScheduling": false,
//     "price": 2000,
//     "duration": "2 horas",
//     "subcategory": "dfadsfasfasd",
//     "likesNumber": 0,
//     "imageUrl": "/uploads/1765913927172-IMG_3276.jpg"