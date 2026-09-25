export interface User {
    id: number,
    name: string,
    email: string,
    cpf_cnpj?: string,
    about:string,
    acceptedTerms?: boolean,
    acceptedAt?: Date,
    /** e-mail confirmado pelo link enviado no cadastro */
    emailVerified?: boolean,
}
