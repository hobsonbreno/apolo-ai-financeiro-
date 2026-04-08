import React, { useState } from 'react';
import { TrendingUp, PieChart, Info } from 'lucide-react';

interface SimulatorProps {
  balance: number;
}

const InvestmentSimulator: React.FC<SimulatorProps> = ({ balance }) => {
  const [months, setMonths] = useState(12);
  const selic = 0.1075; // 10.75% a.a (Simulado Banco Central)

  const calculateReturn = (rate: number) => {
    return balance * Math.pow(1 + rate / 12, months);
  };

  const modalities = [
    { name: 'Caixinhas (100% CDI)', rate: selic, icon: <TrendingUp size={18} />, color: 'blue', desc: 'Liquidez diária, seguro e simples.' },
    { name: 'Tesouro SELIC', rate: selic + 0.005, icon: <TrendingUp size={18} />, color: 'blue', desc: 'O investimento mais seguro do país.' },
    { name: 'LCI / LCA', rate: selic * 0.9, icon: <TrendingUp size={18} />, color: 'green', desc: 'Isento de Imposto de Renda!' },
    { name: 'CDB (110% CDI)', rate: selic * 1.1, icon: <TrendingUp size={18} />, color: 'green', desc: 'Alta rentabilidade com FGC.' },
    { name: 'FIIs (Imobiliário)', rate: 0.12, icon: <PieChart size={18} />, color: 'purple', desc: 'Aluguéis mensais isentos na sua conta.' },
    { name: 'Bolsa de Valores', rate: 0.15, icon: <PieChart size={18} />, color: 'purple', desc: 'Renda variável, potencial de explosão.' },
    { name: 'Criptoativos', rate: 0.40, icon: <PieChart size={18} />, color: 'orange', desc: 'Altíssimo risco. Apenas para diversificar.' },
  ];

  return (
    <div className="simulator-grid flex flex-col gap-24">
      <div className="card glass-premium p-24">
        <div className="flex justify-between items-center mb-24">
          <h2 className="fs-18">Ecossistema de Investimentos: <span className="text-green">Onde seu dinheiro rende mais?</span></h2>
          <div className="badge success">Taxas Atualizadas (BCB)</div>
        </div>

        <div className="flex gap-24 mb-32 items-end">
          <div className="input-field flex-1">
            <label className="dim fs-12 mb-8 block">Tempo da Aplicação (Meses)</label>
            <input 
              type="range" 
              min="1" 
              max="60" 
              value={months} 
              onChange={e => setMonths(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between mt-4 fs-10 dim">
              <span>1 mês</span>
              <span className="text-white fs-14 highlight">{months} meses</span>
              <span>5 anos</span>
            </div>
          </div>
        </div>

        <div className="results-grid-main gap-16">
          {modalities.map((m, i) => (
            <div key={i} className={`investment-card glass-premium p-16 border-${m.color}`}>
              <div className="flex items-center gap-8 mb-12">
                <span className={`text-${m.color}`}>{m.icon}</span>
                <span className="fs-14 fw-600">{m.name}</span>
              </div>
              <p className="dim fs-10 mb-16 h-40">{m.desc}</p>
              <div className="value-box">
                <span className="fs-10 dim block">Total Bruto Estimado</span>
                <h3 className={`text-${m.color}`}>R$ {calculateReturn(m.rate).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                <div className="flex justify-between mt-8">
                   <span className="text-success fs-10">Lucro: +R$ {(calculateReturn(m.rate) - balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                   <span className="dim fs-10">~{((m.rate/12)*100).toFixed(2)}%/mês</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card glass-premium p-24 bg-gradient-blue">
         <div className="flex gap-16 items-start">
            <div className="icon-box info"><Info size={24} /></div>
            <div>
               <h3 className="mb-8">Conselho do Assistente Apolo</h3>
               <p className="fs-14">
                  Com base no seu saldo atual de **R$ {balance.toLocaleString('pt-BR')}**, 
                  o mais indicado é manter **6 meses de seus gastos** no Tesouro SELIC antes de arriscar na Bolsa.
                  Seus gastos médios são de R$ { (balance * 0.7).toFixed(2) } ao mês (estimativa).
               </p>
            </div>
         </div>
      </div>
    </div>
  );
};

export default InvestmentSimulator;
