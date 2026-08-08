import React, { useState, useEffect } from 'react'
import { supabase, supabaseUrl } from '../../lib/supabaseClient'
import { 
  CreditCard, 
  Key, 
  Lock, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  ShieldCheck, 
  ExternalLink,
  Check,
  Zap,
  HelpCircle,
  Smartphone,
  ArrowRight
} from 'lucide-react'

export default function InfinitePaySettings() {
  const [handle, setHandle] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [status, setStatus] = useState({
    checked: false,
    connected: false,
    message: '',
    handleSaved: ''
  })
  
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [notification, setNotification] = useState(null)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setTesting(true)
    setNotification(null)

    try {
      let isConnected = false
      let savedHandle = ''
      let msg = ''

      const { data: settings } = await supabase
        .from('store_settings')
        .select('infinitepay_handle, infinitepay_api_token, infinitepay_status')
        .single()

      if (settings && settings.infinitepay_handle) {
        isConnected = true
        savedHandle = settings.infinitepay_handle
        msg = 'Handle da InfinitePay configurado e ativo com sucesso! 🚀'
      } else {
        const { data: creds } = await supabase
          .from('payment_credentials')
          .select('public_key, access_token')
          .eq('provider', 'infinitepay')
          .single()

        if (creds && creds.public_key) {
          isConnected = true
          savedHandle = creds.public_key
          msg = 'Handle da InfinitePay encontrado nas credenciais de pagamento.'
        }
      }

      if (isConnected) {
        setStatus({
          checked: true,
          connected: true,
          message: msg,
          handleSaved: savedHandle
        })
        setHandle(savedHandle)
        if (settings?.infinitepay_api_token) {
          setApiToken(settings.infinitepay_api_token)
        }
      } else {
        setStatus({
          checked: true,
          connected: false,
          message: 'Nenhum Handle da InfinitePay foi configurado ainda.',
          handleSaved: ''
        })
      }
    } catch (err) {
      setStatus({
        checked: true,
        connected: false,
        message: err.message || 'Erro ao consultar status da InfinitePay.',
        handleSaved: ''
      })
    } finally {
      setTesting(false)
    }
  }

  const handleSaveKeys = async (e) => {
    e.preventDefault()
    setSaving(true)
    setNotification(null)

    const cleanHandle = handle.trim().replace(/^@/, '')

    if (!cleanHandle) {
      setNotification({
        type: 'error',
        message: 'O Handle / InfiniteTag é obrigatório (ex: nomedaloja ou seu_tag)'
      })
      setSaving(false)
      return
    }

    try {
      // Upsert na tabela store_settings
      const { error: dbError } = await supabase
        .from('store_settings')
        .upsert({
          id: '00000000-0000-0000-0000-000000000001',
          infinitepay_handle: cleanHandle,
          infinitepay_api_token: apiToken.trim() || null,
          infinitepay_status: 'ativo',
          updated_at: new Date().toISOString()
        })

      if (dbError) throw new Error(dbError.message)

      // Também grava na tabela payment_credentials para compatibilidade multi-tenant
      await supabase
        .from('payment_credentials')
        .upsert({
          store_id: 'store-default',
          provider: 'infinitepay',
          public_key: cleanHandle,
          access_token: apiToken.trim() || null,
          status: 'válido',
          updated_at: new Date().toISOString()
        })

      setNotification({
        type: 'success',
        message: 'Configurações da InfinitePay salvas com sucesso! 🎉 O checkout já está integrado.'
      })

      setHandle(cleanHandle)
      loadSettings()

    } catch (err) {
      setNotification({
        type: 'error',
        message: err.message || 'Erro ao salvar configurações da InfinitePay.'
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Zap className="w-6 h-6 text-emerald-400" /> Integração InfinitePay (Checkout Transparente & Link)
          </h2>
          <p className="text-slate-400 text-xs mt-0.5">
            Gerencie sua conta InfinitePay para receber vendas via PIX e Cartão de Crédito com taxa reduzida.
          </p>
        </div>

        {/* Indicador de Status Geral */}
        <div className="flex items-center gap-3">
          {status.connected ? (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4" /> Conectado ✅
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
              <AlertTriangle className="w-4 h-4" /> Não Conectado ⚠️
            </div>
          )}

          <button
            onClick={loadSettings}
            disabled={testing}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-all disabled:opacity-50"
            title="Atualizar Conexão"
          >
            <RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Box Alerta de Segurança & Funcionamento */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/20 rounded-2xl p-5 flex items-start gap-4">
        <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl shrink-0 mt-0.5">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div className="text-xs space-y-1">
          <h4 className="font-semibold text-slate-200 text-sm">Como funciona o Checkout da InfinitePay</h4>
          <p className="text-slate-400 leading-relaxed">
            Ao finalizar a compra, o comprador é redirecionado diretamente para o ambiente seguro e criptografado da <strong>InfinitePay</strong>. O comprador preenche seus dados e escolhe se deseja pagar por <strong>PIX</strong> ou <strong>Cartão</strong>. Nenhuma informação bancária sensível passa pela sua loja.
          </p>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className={`p-4 rounded-xl text-sm border flex items-center justify-between ${
          notification.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="text-xs underline opacity-80 hover:opacity-100">
            Fechar
          </button>
        </div>
      )}

      {/* Card Formulário InfinitePay */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">InfinitePay Checkout</h3>
              <p className="text-slate-400 text-xs">Receba PIX com aprovação instantânea e Cartão de Crédito em até 12x</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSaveKeys} className="space-y-5">
          {/* Handle / InfiniteTag */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Handle da InfinitePay (InfiniteTag)</span>
              <span className="text-emerald-400 lowercase text-[11px] font-normal">Ex: nomedaloja ou infinity3d</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 font-mono text-sm">
                @
              </div>
              <input
                type="text"
                required
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="infinity3d"
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl pl-9 pr-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none font-mono"
              />
            </div>
            <span className="text-[11px] text-slate-500 mt-1.5 block">
              Este é o seu nome de usuário/tag cadastrado no aplicativo da InfinitePay.
            </span>
          </div>

          {/* API Token / Bearer (Opcional) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>API Token / Bearer Token (Opcional para Webhooks)</span>
              <span className="text-slate-500 lowercase text-[11px] font-normal">Para confirmação via API Cloudwalk</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder="Ex: inf_live_... (Deixe em branco se usar apenas o Handle)"
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={loadSettings}
              disabled={testing}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
              {testing ? 'Verificando...' : 'Verificar Status'}
            </button>

            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {saving ? (
                'Salvando...'
              ) : (
                <>
                  <Check className="w-4 h-4" /> Salvar Configurações InfinitePay
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Tutorial Passo a Passo */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Onde encontrar o seu Handle (InfiniteTag)?</h3>
              <p className="text-slate-400 text-xs">Instruções para localizar sua tag no app InfinitePay</p>
            </div>
          </div>

          <a 
            href="https://www.infinitepay.io" 
            target="_blank" 
            rel="noreferrer"
            className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg transition-all"
          >
            Site InfinitePay <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-xs">
              1
            </div>
            <h4 className="font-semibold text-white text-sm">Abra o App InfinitePay</h4>
            <p className="text-slate-400">
              Faça login no aplicativo da InfinitePay no seu celular Android ou iPhone.
            </p>
          </div>

          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-xs">
              2
            </div>
            <h4 className="font-semibold text-white text-sm">Acesse o Perfil / Cobrar</h4>
            <p className="text-slate-400">
              Vá em Perfil ou na opção de Vender/Cobrar por Link de Pagamento.
            </p>
          </div>

          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-xs">
              3
            </div>
            <h4 className="font-semibold text-white text-sm">Copie seu Handle</h4>
            <p className="text-slate-400">
              Sua tag estará no formato <code className="bg-slate-900 px-1 py-0.5 rounded text-emerald-300 font-mono">@seuhandle</code>. Copie apenas o texto (sem o @) e cole no campo acima.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
