/**
 * Base fictícia do seed. Empresas, pessoas e e-mails são inventados.
 */

export interface SeedSalesRep {
  name: string;
  email: string;
}

export interface SeedLead {
  companyName: string;
  contactName: string;
  segment: string;
  description: string;
}

export interface SeedProduct {
  name: string;
  minReais: number;
  maxReais: number;
}

export const SEED_SALES_REPS: SeedSalesRep[] = [
  { name: "Mariana Costa", email: "mariana.costa@decoding.demo" },
  { name: "Rafael Lima", email: "rafael.lima@decoding.demo" },
  { name: "Juliana Alves", email: "juliana.alves@decoding.demo" },
  { name: "Bruno Ferreira", email: "bruno.ferreira@decoding.demo" },
  { name: "Camila Rocha", email: "camila.rocha@decoding.demo" },
];

export const SEED_LEADS: SeedLead[] = [
  { companyName: "TransLog Cargas", contactName: "Ricardo Menezes", segment: "Logística", description: "Transportadora rodoviária com 300 caminhões; quer rastrear entregas e reduzir atrasos na operação." },
  { companyName: "Rota Sul Distribuidora", contactName: "Patrícia Gomes", segment: "Logística", description: "Distribuidora regional de alimentos no Sul; busca roteirização e visão de pedidos por cliente." },
  { companyName: "Expresso Paulista", contactName: "Eduardo Nunes", segment: "Logística", description: "Operador logístico de última milha em São Paulo, crescendo com e-commerce." },
  { companyName: "Mercado Bom Preço", contactName: "Fernanda Silva", segment: "Varejo", description: "Rede de supermercados com 12 lojas; quer centralizar relacionamento com fornecedores." },
  { companyName: "Moda Viva Confecções", contactName: "Larissa Prado", segment: "Varejo", description: "Marca de roupas com lojas próprias e franquias; foco em expansão e atendimento ao franqueado." },
  { companyName: "Casa & Conforto Móveis", contactName: "Gustavo Ribeiro", segment: "Varejo", description: "Varejista de móveis com venda consultiva; ciclo de venda longo e muitas propostas." },
  { companyName: "Ótica Visão Clara", contactName: "Beatriz Moura", segment: "Varejo", description: "Rede de óticas em shoppings; quer fidelizar clientes e acompanhar recompra." },
  { companyName: "Clínica Vida Plena", contactName: "Dr. André Carvalho", segment: "Saúde", description: "Clínica multiespecialidades; precisa organizar captação de pacientes particulares e convênios." },
  { companyName: "Laboratório BioAnálise", contactName: "Renata Duarte", segment: "Saúde", description: "Laboratório de análises clínicas com coleta domiciliar; vende para empresas e planos de saúde." },
  { companyName: "OdontoSmile", contactName: "Thiago Barros", segment: "Saúde", description: "Rede de clínicas odontológicas em expansão; quer padronizar o funil comercial entre unidades." },
  { companyName: "Hospital São Lucas", contactName: "Cláudia Mendes", segment: "Saúde", description: "Hospital privado de médio porte; negociação de contratos corporativos de saúde ocupacional." },
  { companyName: "Nuvem Tech Sistemas", contactName: "Felipe Araújo", segment: "Tecnologia", description: "Software house B2B de ERP para PMEs; time de vendas interno com SDRs." },
  { companyName: "DataPrime Analytics", contactName: "Isabela Castro", segment: "Tecnologia", description: "Consultoria de dados e BI; vende projetos sob medida com propostas técnicas." },
  { companyName: "SecureNet Cibersegurança", contactName: "Marcelo Teixeira", segment: "Tecnologia", description: "Empresa de cibersegurança gerenciada; contratos recorrentes com grandes empresas." },
  { companyName: "AppFácil Mobile", contactName: "Natália Freitas", segment: "Tecnologia", description: "Startup de aplicativos white label para pequenos negócios; alto volume de leads." },
  { companyName: "Construtora Horizonte", contactName: "Roberto Pires", segment: "Construção", description: "Construtora de condomínios residenciais; vendas de unidades na planta com corretores." },
  { companyName: "Obra Certa Materiais", contactName: "Sandra Lopes", segment: "Construção", description: "Distribuidora de materiais de construção para construtoras e revendas." },
  { companyName: "Engenharia Alicerce", contactName: "Paulo Henrique Dias", segment: "Construção", description: "Engenharia civil para obras industriais; poucos contratos de alto valor." },
  { companyName: "EducaMais Escolas", contactName: "Vanessa Cardoso", segment: "Educação", description: "Rede de escolas particulares; campanhas de matrícula sazonais e muitos responsáveis no funil." },
  { companyName: "Instituto Saber Online", contactName: "Lucas Martins", segment: "Educação", description: "Plataforma de cursos online corporativos; vende pacotes de treinamento para RH." },
  { companyName: "Idiomas Global", contactName: "Aline Ramos", segment: "Educação", description: "Escola de idiomas com turmas in company para empresas multinacionais." },
  { companyName: "AgroVale Cooperativa", contactName: "José Antônio Reis", segment: "Agronegócio", description: "Cooperativa agrícola de grãos; relacionamento com produtores associados e compradores." },
  { companyName: "Fazenda Boa Safra", contactName: "Helena Vieira", segment: "Agronegócio", description: "Produtora de café especial para exportação; negocia contratos anuais." },
  { companyName: "Sementes Brasil", contactName: "Diego Monteiro", segment: "Agronegócio", description: "Fornecedora de sementes e insumos; equipe de vendas em campo com revendas." },
  { companyName: "Banco Comunitário Aliança", contactName: "Simone Batista", segment: "Serviços Financeiros", description: "Instituição de crédito para pequenos empreendedores; prospecção ativa de clientes PJ." },
  { companyName: "Seguros Proteção Total", contactName: "Rodrigo Azevedo", segment: "Serviços Financeiros", description: "Corretora de seguros empresariais; renovação de apólices e venda cruzada." },
  { companyName: "Contábil Exata", contactName: "Márcia Fonseca", segment: "Serviços Profissionais", description: "Escritório de contabilidade para PMEs; quer organizar captação de novos clientes." },
  { companyName: "Advocacia Moreira & Associados", contactName: "Carlos Moreira", segment: "Serviços Profissionais", description: "Escritório de advocacia empresarial; propostas de honorários para contratos recorrentes." },
  { companyName: "Hotel Mar Azul", contactName: "Priscila Antunes", segment: "Turismo e Hotelaria", description: "Resort no litoral; vende eventos corporativos e pacotes para agências." },
  { companyName: "Viaje Bem Turismo", contactName: "Fábio Correia", segment: "Turismo e Hotelaria", description: "Agência de viagens corporativas; gestão de contas de empresas e negociação de tarifas." },
];

export const SEED_PRODUCTS: SeedProduct[] = [
  { name: "Implantação de CRM", minReais: 18_000, maxReais: 60_000 },
  { name: "Plano Enterprise anual", minReais: 40_000, maxReais: 150_000 },
  { name: "Integração com WhatsApp", minReais: 8_000, maxReais: 25_000 },
  { name: "Consultoria de processo comercial", minReais: 15_000, maxReais: 45_000 },
  { name: "Treinamento de equipe de vendas", minReais: 6_000, maxReais: 20_000 },
  { name: "Automação de marketing", minReais: 12_000, maxReais: 38_000 },
  { name: "Expansão de licenças", minReais: 5_000, maxReais: 30_000 },
  { name: "Projeto de BI comercial", minReais: 20_000, maxReais: 70_000 },
];

export const STAGE_NOTES = {
  novo_contato: ["Lead chegou pelo site, aguardando primeiro contato.", "Indicação de cliente atual; agendar conversa inicial."],
  qualificacao: ["Reunião de diagnóstico realizada; levantando dores e orçamento.", "Validando decisor e prazo de implantação."],
  proposta_enviada: ["Proposta enviada; cliente avaliando internamente.", "Proposta técnica e comercial enviada ao comitê."],
  negociacao: ["Negociando desconto e condições de pagamento.", "Ajustes finais de escopo com o jurídico do cliente."],
  ganho: ["Contrato assinado; repassado para implantação.", "Fechado após aprovação da diretoria."],
  perdido: ["Perdido por preço para concorrente.", "Projeto adiado por corte de orçamento.", "Cliente optou por solução interna."],
} as const;
