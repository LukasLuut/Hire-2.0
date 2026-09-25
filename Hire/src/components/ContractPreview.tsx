/* --------------------------------------------------------------------------
 * ContractPreview.tsx
 *
 * Agora com “modo compatível” para exportação via html2canvas:
 *   → Substitui temporariamente cores OKLCH por equivalentes RGB
 * -------------------------------------------------------------------------- */

import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { contractAPI, type ContractEntity } from "../api/ContractAPI";
import { reaisPorExtenso } from "../utils/extenso";
import { getErrorMessage } from "../utils/errors";

/* --------------------------------------------------------------------------
 * 1. Interface de Tipagem
 * -------------------------------------------------------------------------- */
interface ContractData {
  codigo?: string;
  nome_contratante: string;
  cpf_contratante: string;
  endereco_contratante: string;
  email_contratante: string;
  telefone_contratante: string;
  nome_prestador: string;
  cpf_prestador: string;
  endereco_prestador: string;
  email_prestador: string;
  telefone_prestador: string;
  nome_plataforma: string;
  cnpj_plataforma: string;
  email_plataforma: string;
  descricao_servico: string;
  prazo_execucao: string;
  valor_servico: string;
  valor_extenso: string;
  forma_pagamento: string;
  cidade_forum: string;
  data_assinatura: string;
  cidade_assinatura: string;
}

/* --------------------------------------------------------------------------
 * 2. Dados do contrato real (gerado ao formalizar a negociação)
 * -------------------------------------------------------------------------- */
const NAO_INFORMADO = "não informado";

function formatCpf(v?: string | null) {
  const d = (v ?? "").replace(/\D/g, "");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return v || NAO_INFORMADO;
}

function toContractData(c: ContractEntity): ContractData {
  const term = (key: string) => c.terms.find((t) => t.key === key)?.content?.trim() ?? "";
  const payment = term("payment");
  const method = payment.split("•")[1]?.trim();
  const start = term("start");
  const addr = c.user?.address;
  const city = addr ? `${addr.city} - ${addr.state}` : NAO_INFORMADO;
  const signed = new Date(c.lastContact.length === 10 ? c.lastContact + "T00:00:00" : c.lastContact);

  return {
    codigo: c.code,
    nome_contratante: c.user?.name ?? NAO_INFORMADO,
    cpf_contratante: formatCpf(c.user?.cpf_cnpj),
    endereco_contratante: addr ? `${addr.street}, ${addr.num}, ${addr.neighborhood}, ${addr.city} - ${addr.state}` : NAO_INFORMADO,
    email_contratante: c.user?.email ?? NAO_INFORMADO,
    telefone_contratante: NAO_INFORMADO,
    nome_prestador: c.provider?.companyName || c.provider?.professionalName || NAO_INFORMADO,
    cpf_prestador: formatCpf(c.provider?.cnpj),
    endereco_prestador: NAO_INFORMADO,
    email_prestador: c.provider?.professionalEmail ?? NAO_INFORMADO,
    telefone_prestador: c.provider?.professionalPhone ?? NAO_INFORMADO,
    nome_plataforma: "Hire.",
    cnpj_plataforma: NAO_INFORMADO,
    email_plataforma: "suporte@hire.com",
    descricao_servico: c.description_service,
    prazo_execucao: (term("duration") || c.hire?.service?.duration || "a combinar") + (start ? `, com início em ${start.replace(/^(\d{4}-\d{2}-\d{2})T/, "$1 às ")}` : ""),
    valor_servico: c.price.toFixed(2).replace(".", ","),
    valor_extenso: reaisPorExtenso(c.price),
    forma_pagamento: method ? `via ${method}` : "conforme combinado entre as partes",
    cidade_forum: city,
    data_assinatura: signed.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }),
    cidade_assinatura: city,
  };
}

/** Rota /contract/:id — carrega o contrato real e mostra o documento. */
export function ContractPreview() {
  const { id } = useParams();
  const [data, setData] = useState<ContractData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token || !id) return;
    contractAPI
      .getById(Number(id), token)
      .then((c) => setData(toContractData(c)))
      .catch((err) => setError(getErrorMessage(err, "Contrato não encontrado.")));
  }, [id]);

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--bg-dark)] pt-32 text-center text-[var(--text)]">
        <p className="text-xl font-semibold">{error}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="min-h-screen bg-[var(--bg-dark)] pt-32 flex justify-center">
        <div className="max-w-4xl w-full mx-8 h-[70vh] rounded-2xl bg-[var(--bg-light)] animate-pulse" />
      </div>
    );
  }
  return <ContractDocument data={data} />;
}

/* --------------------------------------------------------------------------
 * 3. Função Principal
 * -------------------------------------------------------------------------- */
export const ContractDocument: React.FC<{ data: ContractData }> = ({ data }) => {
  const contractRef = useRef<HTMLDivElement>(null);

  /* ----------------------------------------------------------------------
   * 3.1. Ativa um "modo compatível" temporário
   * ---------------------------------------------------------------------- */
  const enableCompatibilityMode = () => {
    document.body.classList.add("html2canvas-compat");
  };

  const disableCompatibilityMode = () => {
    document.body.classList.remove("html2canvas-compat");
  };

  /* ----------------------------------------------------------------------
   * 3.2. Função de Exportação em PDF (com modo compatível)
   * ---------------------------------------------------------------------- */
  const handleExportPDF = async () => {
    if (!contractRef.current) return;

    enableCompatibilityMode(); // força modo compatível (sem oklch)
    await new Promise((r) => setTimeout(r, 50)); // pequena espera para re-renderizar

    try {
      const element = contractRef.current;
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Contrato-${data.nome_contratante}.pdf`);
    } finally {
      disableCompatibilityMode(); // restaura o tema original
    }
  };

  /* ----------------------------------------------------------------------
   * 3.3. Renderização do Contrato
   * ---------------------------------------------------------------------- */

  /* ----------------------------------------------------------------------
   * 3.2. Renderização do Contrato
   *      → Estrutura modular e estilizada
   * ---------------------------------------------------------------------- */
  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950 pt-20 p-8">
      {/* Botão de Exportar PDF */}
      <div className="flex justify-end mb-4">
        <button
          onClick={handleExportPDF}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-md transition-all"
        >
          Exportar PDF
        </button>
      </div>

      {/* Conteúdo do Contrato */}
      <div
        ref={contractRef}
        className="max-w-4xl mx-auto p-10 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 rounded-2xl shadow-lg leading-relaxed"
      >
        {/* Cabeçalho */}
        <h1 className="text-2xl font-bold text-center mb-6">
          CONTRATO DE PRESTAÇÃO DE SERVIÇOS ENTRE PARTICULARES
        </h1>
        {data.codigo && <p className="text-center text-sm mb-6">Contrato nº {data.codigo}</p>}

        {/* Identificação das Partes */}
        <section>
          <p className="mb-4">
            <strong>CONTRATANTE:</strong> {data.nome_contratante} — CPF/CNPJ: {data.cpf_contratante}
            <br />
            Endereço: {data.endereco_contratante}
            <br />
            E-mail: {data.email_contratante} — Telefone: {data.telefone_contratante}
          </p>

          <p className="mb-4">
            <strong>CONTRATADO (PRESTADOR DE SERVIÇOS):</strong> {data.nome_prestador} — CPF/CNPJ:{" "}
            {data.cpf_prestador}
            <br />
            Endereço: {data.endereco_prestador}
            <br />
            E-mail: {data.email_prestador} — Telefone: {data.telefone_prestador}
          </p>

          <p className="mb-6">
            <strong>PLATAFORMA INTERMEDIADORA:</strong> {data.nome_plataforma} — CNPJ:{" "}
            {data.cnpj_plataforma}
            <br />
            E-mail: {data.email_plataforma}
            <br />
            (Atua exclusivamente como intermediadora entre as partes, conforme descrito neste
            instrumento.)
          </p>
        </section>

        {/* Corpo Principal do Contrato */}
        <section>
          <h2 className="text-lg font-semibold mt-6 mb-2">1. DO OBJETO</h2>
          <p className="mb-4">
            O presente contrato tem por objeto a prestação do serviço de{" "}
            <strong>{data.descricao_servico}</strong>, a ser executado pelo CONTRATADO em favor do
            CONTRATANTE, conforme os termos e condições acordadas entre as partes por meio da
            plataforma {data.nome_plataforma}.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">2. DO PRAZO E DA EXECUÇÃO</h2>
          <p className="mb-4">
            O prazo estimado para execução do serviço é de <strong>{data.prazo_execucao}</strong>,
            contado a partir da data de aceite deste contrato.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">3. DA REMUNERAÇÃO E FORMA DE PAGAMENTO</h2>
          <p className="mb-4">
            O valor total é de <strong>R$ {data.valor_servico}</strong> ({data.valor_extenso}),
            pago <strong>{data.forma_pagamento}</strong>. O pagamento será processado por meio da
            plataforma {data.nome_plataforma}, que atuará apenas como intermediadora de repasse
            entre as partes.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">4. DAS RESPONSABILIDADES DAS PARTES</h2>
          <p className="mb-4">
            <strong>Do Contratado:</strong> executar o serviço com qualidade, diligência e dentro do
            prazo acordado.
          </p>
          <p className="mb-4">
            <strong>Do Contratante:</strong> fornecer informações corretas e efetuar o pagamento
            dentro do prazo.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">5. DA PLATAFORMA INTERMEDIADORA</h2>
          <p className="mb-4">
            A plataforma {data.nome_plataforma} atua exclusivamente como intermediadora tecnológica,
            não sendo responsável por prazos, qualidade ou execução dos serviços contratados.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">6. DA RESCISÃO</h2>
          <p className="mb-4">
            O contrato poderá ser rescindido por qualquer parte mediante comunicação expressa, em
            casos de descumprimento, inadimplência ou impossibilidade comprovada de execução.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">7. DA CONFIDENCIALIDADE</h2>
          <p className="mb-4">
            As partes comprometem-se a manter sigilo sobre todas as informações trocadas durante a
            execução deste contrato.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">8. DO FORO</h2>
          <p className="mb-4">
            Fica eleito o foro da comarca de <strong>{data.cidade_forum}</strong> para dirimir
            quaisquer controvérsias decorrentes deste contrato.
          </p>

          <h2 className="text-lg font-semibold mt-6 mb-2">9. DA ASSINATURA ELETRÔNICA</h2>
          <p className="mb-4">
            Este contrato é celebrado digitalmente por meio da plataforma {data.nome_plataforma},
            com validade jurídica conforme a Lei nº 14.063/2020.
          </p>
        </section>

        {/* Rodapé / Assinaturas */}
        <footer className="mt-10 text-center border-t border-neutral-300 dark:border-neutral-700 pt-6">
          <p>
            <strong>Data:</strong> {data.data_assinatura} — <strong>Local:</strong>{" "}
            {data.cidade_assinatura}
          </p>
          <div className="mt-6 flex flex-col sm:flex-row justify-around items-center gap-4 text-sm">
            <div>
              <p className="font-semibold">{data.nome_contratante}</p>
              <p>CONTRATANTE</p>
            </div>
            <div>
              <p className="font-semibold">{data.nome_prestador}</p>
              <p>CONTRATADO</p>
            </div>
            <div>
              <p className="font-semibold">{data.nome_plataforma}</p>
              <p>PLATAFORMA</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};
