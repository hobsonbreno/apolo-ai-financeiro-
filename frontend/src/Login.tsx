import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

interface LoginProps {
  onLogin: (user: any, token: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState(1); // 1: request, 2: reset
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryToken, setRecoveryToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [regData, setRegData] = useState({ name: '', email: '', cpf: '', phone: '', password: '', adminCode: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      if (isRegister) {
        // Validação de senha: Maiúscula, Minúscula, Especial, Máx 8
        const hasUpper = /[A-Z]/.test(regData.password);
        const hasLower = /[a-z]/.test(regData.password);
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(regData.password);
        const isCorrectLength = regData.password.length <= 8;

        if (!hasUpper || !hasLower || !hasSpecial) {
          setError('A senha deve conter Letras Maiúsculas, Minúsculas e Caracteres Especiais.');
          setLoading(false);
          return;
        }
        if (!isCorrectLength) {
          setError('A senha não deve ultrapassar 8 caracteres.');
          setLoading(false);
          return;
        }

        await axios.post('http://localhost:3005/api/auth/register-full', regData);
        
        const loginRes = await axios.post('http://localhost:3005/api/auth/login', {
          identifier: regData.email,
          password: regData.password
        });
        onLogin(loginRes.data.user, loginRes.data.token);
      } else {
        const response = await axios.post('http://localhost:3005/api/auth/login', {
          identifier,
          password
        });
        onLogin(response.data.user, response.data.token);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro na operação.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await axios.post('http://localhost:3005/api/auth/request-recovery', { identifier });
      setRecoveryStep(2);
      setSuccessMsg('Token solicitado! Verifique seu console/backend (Simulado).');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao solicitar.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await axios.post('http://localhost:3005/api/auth/reset-password', { token: recoveryToken, newPass: newPassword });
      setSuccessMsg('Senha alterada! Faça login agora.');
      setIsRecovery(false);
      setRecoveryStep(1);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Token inválido ou erro.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card anim-slide-up">
        <div className="logo mb-24">
          <div className="logo-icon">A</div>
          <h1 style={{ color: 'white' }}>Apolo AI</h1>
        </div>
        
        <div className="login-tabs mb-24 flex gap-12">
          <button 
            type="button"
            className={!isRegister ? 'active' : ''} 
            onClick={() => setIsRegister(false)}
            style={{ flex: 1, padding: '10px', borderRadius: '8px' }}
          >
            Entrar
          </button>
          <button 
            type="button"
            className={isRegister ? 'active' : ''} 
            onClick={() => setIsRegister(true)}
            style={{ flex: 1, padding: '10px', borderRadius: '8px' }}
          >
            Cadastrar
          </button>
        </div>

        {error && <div className="error-alert">{error}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-12">
          {isRegister ? (
            <>
              <div className="input-group">
                <label>Nome Completo</label>
                <input type="text" value={regData.name} onChange={e => setRegData({...regData, name: e.target.value})} required />
              </div>
              <div className="flex gap-12">
                <div className="input-group" style={{ flex: 1 }}>
                  <label>E-mail</label>
                  <input type="email" value={regData.email} onChange={e => setRegData({...regData, email: e.target.value})} required />
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>CPF</label>
                  <input type="text" value={regData.cpf} onChange={e => setRegData({...regData, cpf: e.target.value})} required />
                </div>
              </div>
              <div className="input-group">
                <label>WhatsApp</label>
                <input type="text" value={regData.phone} onChange={e => setRegData({...regData, phone: e.target.value})} required />
              </div>
              <div className="input-group">
                <label>Senha (Máx 8, A-z, @)</label>
                <input type="password" maxLength={8} value={regData.password} onChange={e => setRegData({...regData, password: e.target.value})} required />
              </div>
              <div className="input-group">
                <label>Chave Admin (Opcional)</label>
                <input type="text" value={regData.adminCode} onChange={e => setRegData({...regData, adminCode: e.target.value})} placeholder="Para ADM" />
              </div>
            </>
          ) : (
            <>
              <div className="input-group">
                <label>E-mail ou CPF</label>
                <input type="text" value={identifier} onChange={e => setIdentifier(e.target.value)} required />
              </div>
              <div className="input-group">
                <div className="flex justify-between items-center">
                   <label>Senha</label>
                   <button 
                     type="button" 
                     className="dim fs-12 underline" 
                     style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                     onClick={() => { setIsRecovery(true); setError(''); setSuccessMsg(''); }}
                   >
                     Esqueceu a senha?
                   </button>
                </div>
                <input type="password" maxLength={8} value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
            </>
          )}

          {isRecovery ? (
             <div className="flex flex-col gap-12 bg-slate p-16 br-12 border border-white-10">
                <h3 className="fs-16 mb-8 text-center">Recuperação de Acesso</h3>
                {recoveryStep === 1 ? (
                   <div className="flex flex-col gap-12">
                      <p className="dim fs-12">Insira seu e-mail, CPF ou WhatsApp para receber um token.</p>
                      <input 
                        type="text" 
                        placeholder="E-mail ou CPF" 
                        className="w-full" 
                        value={identifier} 
                        onChange={e => setIdentifier(e.target.value)} 
                      />
                      <button type="button" className="btn-primary" onClick={handleRequestRecovery}>Enviar Token</button>
                      <button type="button" className="dim fs-12" onClick={() => setIsRecovery(false)}>Voltar</button>
                   </div>
                ) : (
                   <div className="flex flex-col gap-12">
                      <p className="dim fs-12 text-success">Token enviado! Digite o código e sua nova senha.</p>
                      <input 
                        type="text" 
                        placeholder="Token de 6 dígitos" 
                        className="w-full" 
                        value={recoveryToken} 
                        onChange={e => setRecoveryToken(e.target.value)} 
                      />
                      <input 
                        type="password" 
                        placeholder="Nova senha (máx 8 carac.)" 
                        className="w-full" 
                        value={newPassword} 
                        onChange={e => setNewPassword(e.target.value)} 
                      />
                      <button type="button" className="btn-primary" onClick={handleResetPassword}>Redefinir Senha</button>
                      <button type="button" className="dim fs-12" onClick={() => setRecoveryStep(1)}>Voltar</button>
                   </div>
                )}
             </div>
          ) : (
            <button type="submit" className="btn-primary" style={{ marginTop: '20px', padding: '16px' }} disabled={loading}>
              {loading ? 'Carregando...' : isRegister ? 'Criar Conta' : 'Entrar'}
            </button>
          )}
        </form>

        {successMsg && <div className="mt-12 text-green fs-12 success-box p-8 br-8">{successMsg}</div>}

        <div className="mt-32">
           <p className="dim fs-12 mb-8">{isRegister ? "Já possui conta?" : "Não tem conta?"}</p>
           <button 
             type="button"
             className="btn-ghost" 
             onClick={() => setIsRegister(!isRegister)}
             style={{ color: '#818cf8', background: 'transparent', border: 'none', cursor: 'pointer' }}
           >
             {isRegister ? "Voltar para Login" : "Registrar-se agora"}
           </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
