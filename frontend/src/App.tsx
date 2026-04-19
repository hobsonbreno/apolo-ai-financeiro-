import React, { useState, useEffect } from 'react';
import {
  PieChart, Pie, Cell, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Wallet, TrendingUp, TrendingDown, AlertCircle, PlusCircle, Settings, Activity, Trash2, Edit2 } from 'lucide-react';
import axios from 'axios';
import AdminPanel from './AdminPanel';
import Login from './Login';
import InvestmentSimulator from './InvestmentSimulator';
import './App.css';

const API_BASE = '/api/financial';

const COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

interface TransactionFormData {
  description: string;
  amount: string;
  installments: string;
  date: string;
  categoryName: string;
}

function App() {
  const [user, setUser] = useState<any>(JSON.parse(localStorage.getItem('user') || 'null'));
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [view, setView] = useState('user'); // 'user' or 'admin'
  const [summary, setSummary] = useState({ totalExpenses: 0, totalIncome: 0, balance: 0 });
  const [expenses, setExpenses] = useState<any[]>([]);
  const [incomes, setIncomes] = useState<any[]>([]);
  const [projection, setProjection] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'expense' | 'income'>('expense');
  const [formData, setFormData] = useState<TransactionFormData>({ description: '', amount: '', installments: '1', date: new Date().toISOString().split('T')[0], categoryName: 'Alimentação' });
  const [showQRModal, setShowQRModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profileUrl, setProfileUrl] = useState(user?.avatarUrl || '');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [qrVersion, setQrVersion] = useState(Date.now());
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedTx, setSelectedTx] = useState<any>(null);

  const handleEditTransaction = (tx: any) => {
    setEditingTransaction(tx);
    setFormData({
      description: tx.description.split(' (')[0], 
      amount: tx.amount.toString(),
      installments: tx.installments.toString(),
      date: new Date(tx.date).toISOString().split('T')[0],
      categoryName: tx.categoryName || 'Outros'
    });
    setModalType(tx.type);
    setIsCustomCategory(false);
    setShowModal(true);
  };

  const handleDeleteClick = (tx: any) => {
    setSelectedTx(tx);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async (allInstallments: boolean) => {
    if (!selectedTx) return;
    try {
      const endpoint = selectedTx.type === 'income' ? 'income' : 'expenses';
      await axios.delete(`${API_BASE}/${endpoint}/${selectedTx._id}?allInstallments=${allInstallments}`);
      fetchData();
      setShowDeleteConfirm(false);
      setSelectedTx(null);
    } catch (error) {
      console.error('Erro ao excluir:', error);
      alert('Falha ao excluir. Tente novamente.');
    }
  };

  // Polling para atualizar o QR Code em tempo real quando o modal está aberto
  useEffect(() => {
    let interval: any;
    if (showQRModal) {
      interval = setInterval(() => {
        setQrVersion(Date.now());
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [showQRModal]);

  const phone = user?.phone || '5511999999999';

  const handleLogin = (userData: any, userToken: string) => {
    setUser(userData);
    setToken(userToken);
    setProfileUrl(userData.avatarUrl || '');
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', userToken);
    if (userData.role === 'admin') setView('admin');
    else setView('user');
  };

  const handleUpdateProfile = async (data: any) => {
    try {
      const response = await axios.patch(`/api/auth/profile/${user._id || user.id}`,
        data,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const updatedUser = response.data.user || { ...user, ...data };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setShowProfileModal(false);
      alert('Perfil atualizado com sucesso!');
    } catch (err: any) {
      console.error('Erro ao atualizar perfil:', err);
      alert(err.response?.data?.message || 'Erro ao atualizar perfil.');
    }
  };

  const handleCEP = async (cep: string) => {
    if (cep.length === 8) {
      try {
        const res = await axios.get(`https://viacep.com.br/ws/${cep}/json/`);
        if (!res.data.erro) {
          // Atualiza campos de endereço no formulário (via DOM ou estado se preferir)
          const addrInput = document.getElementsByName('address')[0] as HTMLInputElement;
          const cityInput = document.getElementsByName('city')[0] as HTMLInputElement;
          const stateInput = document.getElementsByName('state')[0] as HTMLInputElement;
          if (addrInput) addrInput.value = res.data.logradouro;
          if (cityInput) cityInput.value = res.data.localidade;
          if (stateInput) stateInput.value = res.data.uf;
        }
      } catch (err) {
        console.error('CEP fail');
      }
    }
  };

  const handleExport = () => {
    const csvContent = "data:text/csv;charset=utf-8,"
      + "Data,Descricao,Valor,Tipo,Categoria\n"
      + allTransactions.map(tx => `${new Date(tx.date).toLocaleDateString()},${tx.description},${tx.amount},${tx.type},${tx.categoryName || ''}`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `extrato_apolo_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  const handleImport = async (e: any) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target?.result as string;
        const rows = text.split("\n").slice(1); // Skip header
        for (const row of rows) {
          const [date, description, amount, type, category] = row.split(",");
          if (description && amount) {
            try {
              const endpoint = type === 'income' ? `${API_BASE}/income` : `${API_BASE}/expenses`;
              await axios.post(endpoint, {
                phone,
                description,
                amount: parseFloat(amount),
                date: date ? new Date(date).toISOString() : new Date().toISOString(),
                categoryName: category,
                installments: 1
              }, { headers: { Authorization: `Bearer ${token}` } });
            } catch (err) {
              console.error('Erro na linha do CSV', err);
            }
          }
        }
        alert('Importação concluída! Recarregando...');
        fetchData();
      };
      reader.readAsText(file);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const [summaryRes, expensesRes, incomesRes, projectionRes] = await Promise.all([
        axios.get(`${API_BASE}/summary?phone=${phone}`, config),
        axios.get(`${API_BASE}/expenses?phone=${phone}`, config),
        axios.get(`${API_BASE}/income?phone=${phone}`, config),
        axios.get(`${API_BASE}/projection?phone=${phone}`, config)
      ]);
      setSummary(summaryRes.data);
      setExpenses(expensesRes.data || []);
      setIncomes(incomesRes.data || []);
      setProjection(projectionRes.data || []);
    } catch (error) {
      console.error("Error fetching data", error);
    } finally {
      setLoading(false);
    }
  };

  const allTransactions = [
    ...expenses.map((e: any) => ({ ...e, type: 'expense' })),
    ...incomes.map((i: any) => ({ ...i, type: 'income' }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleAddExpense = () => {
    setEditingTransaction(null);
    setModalType('expense');
    setFormData({ description: '', amount: '', installments: '1', date: new Date().toISOString().split('T')[0], categoryName: 'Alimentação' });
    setIsCustomCategory(false);
    setShowModal(true);
  };

  const handleAddIncome = () => {
    setEditingTransaction(null);
    setModalType('income');
    setFormData({ description: '', amount: '', installments: '1', date: new Date().toISOString().split('T')[0], categoryName: 'Salário' });
    setIsCustomCategory(false);
    setShowModal(true);
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = modalType === 'expense' ? 'expenses' : `income`;
    try {
      const payload = {
        ...formData,
        amount: parseFloat(formData.amount) || 0,
        installments: parseInt(formData.installments) || 1,
        phone: phone
      };

      if (editingTransaction) {
        const updateAll = editingTransaction.installments > 1 ? window.confirm('Deseja atualizar todas as parcelas deste lançamento?') : false;
        await axios.patch(`${API_BASE}/${endpoint}/${editingTransaction._id}?allInstallments=${updateAll}`, payload);
      } else {
        await axios.post(`${API_BASE}/${endpoint}`, payload);
      }

      setShowModal(false);
      setEditingTransaction(null);
      setFormData({ description: '', amount: '', installments: '1', date: new Date().toISOString().split('T')[0], categoryName: 'Salário' });
      fetchData();
      alert(editingTransaction ? 'Lançamento atualizado!' : 'Lançamento registrado!');
    } catch (err) {
      console.error("Error submitting modal", err);
      alert('Erro ao salvar lançamento.');
    }
  };

  // Process data for charts
  const categoryData = expenses.reduce((acc, curr) => {
    const existing = acc.find((item: any) => item.name === curr.categoryName);
    if (existing) {
      existing.value += curr.amount;
    } else {
      acc.push({ name: curr.categoryName || 'Outros', value: curr.amount });
    }
    return acc;
  }, [] as any[]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f172a', color: 'white' }}>
        <p>Apolo está preparando seus dados...</p>
      </div>
    );
  }

  if (!token) return <Login onLogin={handleLogin} />;

  return (
    <div className="dashboard-layout">
      {/* MODAL PERFIL */}
      {showProfileModal && (
        <div className="modal-overlay" onClick={() => setShowProfileModal(false)}>
          <div className="modal-content glass-premium anim-slide-up" onClick={e => e.stopPropagation()}>
            <div className="profile-edit-header flex flex-col items-center mb-32">
              <div className="avatar-large mb-16 cursor-pointer" onClick={() => window.open(user?.avatarUrl || '', '_blank')}>
                <img src={user?.avatarUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Apolo'} alt="Avatar" className="w-full h-full rounded-full object-cover" />
              </div>
              <h3 className="mb-4">{user?.name || 'Seu Perfil'}</h3>
              <p className="dim fs-12 mb-24">Clique na foto para ampliar (HD)</p>
            </div>
            <form className="flex flex-col gap-12" onSubmit={handleUpdateProfile}>
              <div className="input-field">
                <label className="dim fs-12 mb-4 block">URL da Foto de Perfil</label>
                <input
                  type="text"
                  value={profileUrl}
                  onChange={(e) => setProfileUrl(e.target.value)}
                  className="w-full bg-slate p-8 rounded"
                  placeholder="https://..."
                />
              </div>
              <div className="flex justify-end gap-12 mt-16">
                <button type="button" className="btn-secondary" onClick={() => setShowProfileModal(false)}>Fechar</button>
                <button type="button" className="btn-primary" onClick={() => handleUpdateProfile({ avatarUrl: profileUrl })}>Salvar Foto</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL WHATSAPP / QR */}
      {showQRModal && (
        <div className="modal-overlay" onClick={() => setShowQRModal(false)}>
          <div className="modal-content glass-premium anim-slide-up text-center" onClick={e => e.stopPropagation()}>
            <h3 className="mb-16">Conectar ao WhatsApp</h3>
            <p className="dim mb-32">Aponte a câmera do seu WhatsApp para o código QR abaixo.</p>
            <div className="qr-container bg-white p-12 rounded inline-block mb-32">
              <img src={`/api/financial/qr?t=${qrVersion}`} alt="QR" style={{ width: 220, height: 220 }} />
            </div>
            <div className="flex justify-center">
              <button className="btn-primary" onClick={() => setShowQRModal(false)}>Concluir</button>
            </div>
          </div>
        </div>
      )}

      <aside className="sidebar">
        <div className="logo">
          <div className="logo-icon">A</div>
          <h1>Apolo <span className="highlight">AI</span></h1>
        </div>
        <nav className="nav-menu">
          <button className={view === 'user' ? 'active' : ''} onClick={() => setView('user')}>
            <TrendingUp size={20} />
            <span>Dashboard</span>
          </button>

          <button className={view === 'profile' ? 'active' : ''} onClick={() => setView('profile')}>
            <Settings size={20} />
            <span>Meus Dados</span>
          </button>

          <button className={view === 'simulator' ? 'active' : ''} onClick={() => setView('simulator')}>
            <TrendingUp size={20} />
            <span>Simulador IA</span>
          </button>

          {user?.role === 'admin' && (
            <button className={view === 'admin' ? 'active' : ''} onClick={() => setView('admin')}>
              <Activity size={20} />
              <span>Gestão Adm</span>
            </button>
          )}

          <div className="nav-spacer"></div>

          <button onClick={() => setShowQRModal(true)}>
            <AlertCircle size={20} />
            <span>Conectar Zap</span>
          </button>

          <button className="nav-logout" onClick={handleLogout}>
            <AlertCircle size={20} />
            <span>Sair</span>
          </button>
        </nav>
      </aside>

      <div className="main-content">
        <header className="top-header">
          <div className="header-search">
            <input type="text" placeholder="Buscar transações..." />
          </div>
          <div className="header-user">
            <div className="notifications"><AlertCircle size={20} /></div>
            <div className="user-info cursor-pointer" onClick={() => setShowProfileModal(true)}>
              <span>{user?.name || 'Usuário'}</span>
              <div className="avatar">
                <img src={user?.avatarUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Apolo'} alt="Avatar" className="w-full h-full rounded-full object-cover" />
              </div>
            </div>
          </div>
        </header>

        {showModal && (
          <div className="modal-overlay">
            <div className="modal-content glass-premium anim-slide-up">
              <h3 className="mb-16">{editingTransaction ? 'Editar' : 'Novo'} Lançamento ({modalType === 'expense' ? 'Despesa' : 'Receita'})</h3>
              <form onSubmit={handleModalSubmit}>
                <div className="input-field mb-12">
                  <label className="dim fs-12 mb-4 block">Descrição</label>
                  <input
                    type="text"
                    className="w-full bg-slate p-8 rounded"
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    required
                  />
                </div>
                <div className="flex gap-12 mb-12">
                  <div className="input-field flex-1">
                    <label className="dim fs-12 mb-4 block">Valor (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full bg-slate p-8 rounded"
                      value={formData.amount}
                      onChange={e => setFormData({ ...formData, amount: e.target.value })}
                      required
                    />
                  </div>
                  <div className="input-field flex-1">
                    <label className="dim fs-12 mb-4 block">Parcelas / Repetições</label>
                    <input
                      type="number"
                      min="1"
                      className="w-full bg-slate p-8 rounded"
                      value={formData.installments}
                      onChange={e => setFormData({ ...formData, installments: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex gap-12 mb-12">
                  <div className="input-field flex-1">
                    <label className="dim fs-12 mb-4 block">Categoria</label>
                    <select
                      className="w-full bg-slate p-8 rounded"
                      style={{ color: 'white' }}
                      value={isCustomCategory ? 'Outros' : ((formData as any).categoryName || (modalType === 'income' ? 'Salário' : 'Alimentação'))}
                      onChange={e => {
                        if (e.target.value === 'Outros') {
                          setIsCustomCategory(true);
                          setFormData({ ...formData, categoryName: '' } as any);
                        } else {
                          setIsCustomCategory(false);
                          setFormData({ ...formData, categoryName: e.target.value } as any);
                        }
                      }}
                    >
                      {modalType === 'income' ? (
                        <>
                          <option value="Salário">Salário</option>
                          <option value="Investimento">Investimento</option>
                          <option value="Freelance">Freelance</option>
                          <option value="Outros">Outros (Personalizado)</option>
                        </>
                      ) : (
                        <>
                          <option value="Alimentação">Alimentação</option>
                          <option value="Transporte">Transporte</option>
                          <option value="Saúde">Saúde</option>
                          <option value="Moradia">Moradia</option>
                          <option value="Lazer">Lazer</option>
                          <option value="Outros">Outros (Personalizado)</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                {isCustomCategory && (
                  <div className="input-field mb-12 anim-slide-up">
                    <label className="dim fs-12 mb-4 block">Nome da Nova Categoria</label>
                    <input
                      type="text"
                      className="w-full bg-slate p-8 rounded"
                      placeholder="Ex: Presentes, Academia, etc."
                      value={(formData as any).categoryName}
                      onChange={e => setFormData({ ...formData, categoryName: e.target.value } as any)}
                      required
                    />
                  </div>
                )}
                <div className="input-field mb-16">
                  <label className="dim fs-12 mb-4 block">Data</label>
                  <input
                    type="date"
                    className="w-full bg-slate p-8 rounded"
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
                <div className="flex justify-end gap-12 mt-20">
                  <button type="button" className="btn-secondary" onClick={() => { setShowModal(false); setEditingTransaction(null); }}>Cancelar</button>
                  <button type="submit" className="btn-primary">{editingTransaction ? 'Salvar Alterações' : 'Registrar'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showDeleteConfirm && (
          <div className="modal-overlay">
            <div className="modal-content glass-premium anim-slide-up" style={{ maxWidth: '400px', textAlign: 'center' }}>
              <div className="icon-box red mb-16" style={{ margin: '0 auto 16px' }}>
                <Trash2 size={32} />
              </div>
              <h3 className="mb-8">Confirmar Exclusão</h3>
              <p className="dim mb-24">
                Como deseja excluir o lançamento <strong>"{selectedTx?.description}"</strong>?
              </p>
              
              <div className="flex flex-col gap-12">
                <button className="btn-danger-large w-full" onClick={() => confirmDelete(false)}>
                  Apagar apenas esta parcela
                </button>
                {selectedTx?.installments > 1 && (
                  <button className="btn-secondary w-full" onClick={() => confirmDelete(true)} style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
                    Apagar todas as parcelas
                  </button>
                )}
                <button className="btn-ghost w-full" onClick={() => setShowDeleteConfirm(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {view === 'user' ? (
          <div className="dashboard-content">
            <div className="welcome-section">
              <h1>Bem-vindo de volta, <span className="gradient-text">{user?.name?.split(' ')[0] || 'Usuário'}</span></h1>
              <p>Sua projeção de saldo acumulado para o ano é de R$ {projection[11]?.cumulative?.toLocaleString('pt-BR') || '0'}.</p>
            </div>

            <section className="summary-grid">
              <div className="stat-card glass-premium">
                <div className="stat-header">
                  <div className="icon-box blue"><Wallet size={24} /></div>
                  <span className="trend positive">+3.2%</span>
                </div>
                <div className="stat-body">
                  <p>Saldo Geral</p>
                  <h3>R$ {summary.balance?.toLocaleString('pt-BR') || '0'}</h3>
                </div>
              </div>
              <div className="stat-card glass-premium">
                <div className="stat-header">
                  <div className="icon-box green"><TrendingUp size={24} /></div>
                </div>
                <div className="stat-body">
                  <p>Entradas (Total)</p>
                  <h3>R$ {summary.totalIncome?.toLocaleString('pt-BR') || '0'}</h3>
                </div>
              </div>
              <div className="stat-card glass-premium">
                <div className="stat-header">
                  <div className="icon-box red"><TrendingDown size={24} /></div>
                </div>
                <div className="stat-body">
                  <p>Saídas (Total)</p>
                  <h3>R$ {summary.totalExpenses?.toLocaleString('pt-BR') || '0'}</h3>
                </div>
              </div>
            </section>
            <div className="main-grid">
              <section className="charts-area">
                <div className="card glass-premium">
                  <div className="card-header">
                    <h2>Visão Geral de Gastos</h2>
                  </div>
                  <div className="chart-wrapper">
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={categoryData}
                          innerRadius={70}
                          outerRadius={90}
                          paddingAngle={8}
                          dataKey="value"
                          stroke="none"
                        >
                          {categoryData.map((_: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </section>

              <section className="transactions-area">
                <div className="card glass-premium">
                  <div className="card-header">
                    <h2>Últimas Atividades</h2>
                    <div className="flex gap-8 wrap">
                      <button className="btn-income btn-sm" onClick={handleAddIncome}>
                        <PlusCircle size={14} /> Receita
                      </button>
                      <button className="btn-primary btn-sm" onClick={handleAddExpense}>
                        <PlusCircle size={14} /> Gasto
                      </button>
                      <div className="v-divider"></div>
                      <button className="btn-secondary btn-sm" onClick={handleExport} title="Exportar CSV">
                        <Activity size={14} /> Exportar
                      </button>
                      <label className="btn-secondary btn-sm cursor-pointer" title="Importar CSV">
                        <TrendingUp size={14} /> Importar
                        <input type="file" accept=".csv" onChange={handleImport} hidden />
                      </label>
                    </div>
                  </div>
                  <div className="transaction-list">
                    <table className="admin-table mini-table">
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Descrição</th>
                          <th>Valor</th>
                          <th>Parc.</th>
                          <th style={{ textAlign: 'right' }}>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allTransactions.slice(0, 12).map((tx: any, i: number) => (
                          <tr key={i} className="anim-fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
                            <td>{new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</td>
                            <td>
                              <div className="flex flex-col">
                                <span className="fs-14 fw-500">
                                  <span className={`type-dot ${tx.type}`}></span>
                                  {tx.description}
                                </span>
                                <span className="dim fs-10">{tx.categoryName || 'Sem Categoria'}</span>
                              </div>
                            </td>
                            <td className={tx.type === 'income' ? 'text-green fw-600' : 'text-red fw-600'}>
                              {tx.type === 'income' ? '+' : '-'} R$ {tx.amount.toFixed(2)}
                            </td>
                            <td>
                               <span className="badge-small">{tx.installments > 1 ? `${tx.installmentIndex}/${tx.installments}` : '1/1'}</span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div className="flex justify-end gap-8">
                                <button 
                                  className="icon-btn-sm blue" 
                                  onClick={() => handleEditTransaction(tx)}
                                  title="Editar"
                                >
                                  <Edit2 size={12} />
                                </button>
                                <button 
                                  className="icon-btn-sm red" 
                                  onClick={() => handleDeleteClick(tx)}
                                  title="Excluir"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {allTransactions.length === 0 && <div className="empty-state">Sem transações registradas.</div>}
                  </div>
                </div>
              </section>
            </div>

            <div className="main-grid full-width-grid">
              <section className="card glass-premium projection-card">
                <div className="card-header">
                  <h2>📈 Projeção de Fluxo de Caixa (Anual)</h2>
                  <p className="dim">Clique em uma barra para ver o detalhamento do mês</p>
                </div>

                {selectedMonth !== null && projection[selectedMonth] && (
                  <div className="calc-summary anim-fade-in" style={{ margin: '0 20px 20px' }}>
                    <div className="calc-item">
                      <span className="calc-label">Entradas</span>
                      <span className="calc-value text-green">R$ {projection[selectedMonth].income.toLocaleString('pt-BR')}</span>
                    </div>
                    <div className="dim" style={{ alignSelf: 'center' }}>−</div>
                    <div className="calc-item">
                      <span className="calc-label">Despesas</span>
                      <span className="calc-value text-red">R$ {projection[selectedMonth].expenses.toLocaleString('pt-BR')}</span>
                    </div>
                    <div className="dim" style={{ alignSelf: 'center' }}>=</div>
                    <div className="calc-item">
                      <span className="calc-label">Projeção Mensal</span>
                      <span className="calc-value highlight">R$ {(projection[selectedMonth].income - projection[selectedMonth].expenses).toLocaleString('pt-BR')}</span>
                    </div>
                    <div className="dim" style={{ alignSelf: 'center' }}>➔</div>
                    <div className="calc-item">
                      <span className="calc-label">Saldo Acumulado</span>
                      <span className="calc-value" style={{ color: '#6366f1' }}>R$ {projection[selectedMonth].cumulative.toLocaleString('pt-BR')}</span>
                    </div>
                  </div>
                )}

                <div className="chart-wrapper">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart
                      data={projection}
                      onClick={(data) => data && setSelectedMonth(data.activeTooltipIndex ?? null)}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis dataKey="month" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }}
                      />
                      <Legend />
                      <Bar dataKey="income" name="Entradas" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expenses" name="Saídas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="cumulative" name="Acumulado" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {selectedMonth !== null && projection[selectedMonth] && (
                  <div className="projection-details mt-24 anim-fade-in">
                    <h3 className="mb-12">Detalhamento: <span className="gradient-text">{projection[selectedMonth].month}</span></h3>
                    <div className="details-grid">
                      <div className="details-col">
                        <h4 className="text-green mb-8">Entradas</h4>
                        {projection[selectedMonth].details.filter((d: any) => d.type === 'income').map((d: any, i: number) => (
                          <div key={i} className="detail-item">
                            <span>{d.name}</span>
                            <span className="text-green">+ R$ {d.amount.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="details-col">
                        <h4 className="text-red mb-8">Saídas (Parcelados/Fixos)</h4>
                        {projection[selectedMonth].details.filter((d: any) => d.type === 'expense').map((d: any, i: number) => (
                          <div key={i} className="detail-item">
                            <span>{d.name}</span>
                            <span className="text-red">- R$ {d.amount.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>
        ) : view === 'profile' ? (
          <div className="dashboard-content anim-fade-in">
            <div className="welcome-section">
              <h1>Atualização de <span className="gradient-text">Cadastro</span></h1>
              <p>Mantenha seus dados seguros e atualizados.</p>
            </div>

            <div className="profile-grid-custom anim-slide-up">
              {/* CARD 1: DADOS PESSOAIS */}
              <div className="card glass-premium">
                <div className="card-header border-b">
                  <h2 className="fs-16"><Wallet size={18} className="text-blue mr-8" /> Dados Pessoais</h2>
                </div>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  handleUpdateProfile(Object.fromEntries(fd.entries()));
                }} className="flex flex-col gap-16 p-24">
                  <div className="input-field">
                    <label className="dim fs-11 mb-4 block uppercase fw-600">Nome Completo</label>
                    <input type="text" name="name" className="w-full bg-slate p-12 rounded border-slate-light focus-blue" defaultValue={user?.name} required />
                  </div>
                  <div className="input-field">
                    <label className="dim fs-11 mb-4 block uppercase fw-600">Email de Contato</label>
                    <input type="email" name="email" className="w-full bg-slate p-12 rounded border-slate-light focus-blue" defaultValue={user?.email} required />
                  </div>
                  <div className="flex gap-16">
                    <div className="input-field flex-1">
                      <label className="dim fs-11 mb-4 block uppercase fw-600">CPF</label>
                      <input type="text" name="cpf" className="w-full bg-slate p-12 rounded border-slate-light focus-blue" defaultValue={user?.cpf} required />
                    </div>
                    <div className="input-field flex-1">
                      <label className="dim fs-11 mb-4 block uppercase fw-600">WhatsApp</label>
                      <input type="text" name="phone" className="w-full bg-slate p-12 rounded border-slate-light focus-blue" defaultValue={user?.phone} required />
                    </div>
                  </div>
                  <button type="submit" className="btn-primary py-12 mt-8">Salvar Dados Pessoais</button>
                </form>
              </div>

              {/* CARD 2: ENDEREÇO */}
              <div className="card glass-premium">
                <div className="card-header border-b">
                  <h2 className="fs-16"><Activity size={18} className="text-green mr-8" /> Endereço Residencial</h2>
                </div>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  handleUpdateProfile(Object.fromEntries(fd.entries()));
                }} className="flex flex-col gap-16 p-24">
                  <div className="input-field">
                    <label className="dim fs-11 mb-4 block uppercase fw-600">CEP (Auto-preenchimento)</label>
                    <input type="text" name="cep" className="w-full bg-slate p-12 rounded border-slate-light focus-green" defaultValue={user?.cep} maxLength={8} onChange={e => handleCEP(e.target.value)} placeholder="00000000" />
                  </div>
                  <div className="flex gap-16">
                    <div className="input-field flex-3">
                      <label className="dim fs-11 mb-4 block uppercase fw-600">Logradouro / Rua</label>
                      <input type="text" name="address" className="w-full bg-slate p-12 rounded border-slate-light" defaultValue={user?.address} />
                    </div>
                    <div className="input-field flex-1">
                      <label className="dim fs-11 mb-4 block uppercase fw-600">Número</label>
                      <input type="text" name="addressNumber" className="w-full bg-slate p-12 rounded border-slate-light" defaultValue={user?.addressNumber} />
                    </div>
                  </div>
                  <div className="flex gap-16">
                    <div className="input-field flex-2">
                      <label className="dim fs-11 mb-4 block uppercase fw-600">Cidade</label>
                      <input type="text" name="city" className="w-full bg-slate p-12 rounded border-slate-light" defaultValue={user?.city} />
                    </div>
                    <div className="input-field flex-1">
                      <label className="dim fs-11 mb-4 block uppercase fw-600">Estado (UF)</label>
                      <input type="text" name="state" className="w-full bg-slate p-12 rounded border-slate-light" defaultValue={user?.state} maxLength={2} />
                    </div>
                  </div>
                  <button type="submit" className="btn-primary py-12 mt-8 bg-green">Atualizar Localização</button>
                </form>
              </div>

              {/* CARD 3: SEGURANÇA */}
              <div className="card glass-premium">
                <div className="card-header border-b text-red">
                  <h2 className="fs-16"><Settings size={18} className="mr-8" /> Segurança da Conta</h2>
                </div>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const data = Object.fromEntries(fd.entries());
                  if (data.newPass) {
                    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\W).{1,8}$/;
                    if (!regex.test(data.newPass as string)) {
                      alert('A senha deve conter Maiúsculas, Minúsculas, Caracteres Especiais e no máximo 8 caracteres.');
                      return;
                    }
                    handleUpdateProfile({ password: data.newPass });
                  }
                }} className="flex flex-col gap-16 p-24">
                  <div className="input-field">
                    <label className="dim fs-11 mb-4 block uppercase fw-600">Nova Senha</label>
                    <input type="password" name="newPass" className="w-full bg-slate p-12 rounded border-slate-light focus-red" maxLength={8} placeholder="••••••••" />
                    <p className="fs-10 dim mt-8 italic">Use letras (A/a) e símbolos (!@#).</p>
                  </div>
                  <button type="submit" className="btn-primary py-12 mt-8 bg-red">Alterar Senha de Acesso</button>
                </form>
              </div>
            </div>
          </div>
        ) : view === 'simulator' ? (
          <div className="dashboard-content anim-fade-in">
            <div className="welcome-section">
              <h1>Simulador de <span className="gradient-text">Investimentos</span></h1>
              <p>Baseado nos dados do Banco Central e seu saldo atual de R$ {summary.balance.toLocaleString('pt-BR')}</p>
            </div>

            <InvestmentSimulator balance={summary.balance} />
          </div>
        ) : (
          <AdminPanel />
        )}
      </div>
    </div>
  );
}

export default App;
