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
    /** receber os avisos também por e-mail */
    emailNotifications?: boolean,
    /** foto do perfil pessoal */
    avatarUrl?: string | null,
    /** acesso ao painel de administração */
    isAdmin?: boolean,
}
