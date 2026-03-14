import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../../context/AppContext'
import { uuid } from '../../utils/uuid'

interface Props {
  onClose: () => void
}

const panels = [
  { id: 'account', label: 'Minha Conta', icon: 'fa-user' },
  { id: 'mfa', label: 'MultiFactor Authentication', icon: 'fa-shield-alt' },
  { id: 'profile', label: 'Perfil', icon: 'fa-id-card' },
  { id: 'appearance', label: 'Aparência', icon: 'fa-palette' },
  { id: 'voice', label: 'Voz', icon: 'fa-microphone' },
]

export default function SettingsModal({ onClose }: Props) {
  const [activePanel, setActivePanel] = useState('account')
  const [mfaEmail, setMfaEmail] = useState('')
  const [mfaPassword, setMfaPassword] = useState('')
  const [mfaPasswordConfirm, setMfaPasswordConfirm] = useState('')
  const { currentUser, settings, updateSettings, updateUser, logout, toast } = useApp()

  useEffect(() => {
    if (activePanel === 'mfa') setMfaEmail(currentUser?.email || '')
  }, [activePanel, currentUser?.email])

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-liberty-black-light rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-liberty-black-card flex"
        >
          <div className="w-48 border-r border-liberty-black-lighter p-4 flex flex-col gap-1">
            {panels.map((p) => (
              <button
                key={p.id}
                onClick={() => setActivePanel(p.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                  activePanel === p.id ? 'bg-liberty-yellow/20 text-liberty-yellow' : 'text-gray-400 hover:text-white hover:bg-liberty-black-lighter'
                }`}
              >
                <i className={`fas ${p.icon} w-4`} />
                <span className="text-sm font-medium">{p.label}</span>
              </button>
            ))}
            <div className="mt-auto pt-4 border-t border-liberty-black-lighter">
              <button
                onClick={logout}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10 w-full text-left transition-colors"
              >
                <i className="fas fa-sign-out-alt w-4" />
                <span className="text-sm font-medium">Sair</span>
              </button>
            </div>
          </div>
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-liberty-yellow">Configurações</h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded flex items-center justify-center hover:bg-liberty-black-lighter text-gray-400 hover:text-white"
              >
                <i className="fas fa-times" />
              </button>
            </div>
            <AnimatePresence mode="wait">
              {activePanel === 'account' && (
                <motion.div
                  key="account"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-liberty-yellow flex items-center justify-center text-black">
                      {currentUser?.avatar ? (
                        <img src={currentUser.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <i className="fas fa-user text-2xl" />
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-white">{currentUser?.username}</div>
                      <div className="text-sm text-gray-500">{currentUser?.tag}</div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Nome</label>
                    <input
                      type="text"
                      defaultValue={currentUser?.username}
                      onBlur={(e) => {
                        const v = e.target.value.trim()
                        if (v && v !== currentUser?.username) updateUser({ username: v })
                      }}
                      className="w-full px-4 py-2 rounded-lg bg-liberty-black border border-liberty-black-lighter text-white"
                    />
                  </div>
                </motion.div>
              )}
              {activePanel === 'mfa' && (
                <motion.div
                  key="mfa"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-4"
                >
                  <h3 className="text-lg font-semibold text-white">MultiFactor Authentication</h3>
                  <p className="text-sm text-gray-500">Adicione camadas extras de segurança à sua conta.</p>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Email</label>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={mfaEmail}
                        onChange={(e) => setMfaEmail(e.target.value)}
                        placeholder={currentUser?.email || 'Adicionar email'}
                        className="flex-1 px-4 py-2 rounded-lg bg-liberty-black border border-liberty-black-lighter text-white"
                      />
                      <button
                        onClick={() => {
                          if (mfaEmail) updateUser({ email: mfaEmail })
                          toast('Email salvo!')
                        }}
                        className="px-4 py-2 rounded-lg border border-liberty-yellow text-liberty-yellow hover:bg-liberty-yellow/10"
                      >
                        Salvar
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Senha</label>
                    <input
                      type="password"
                      value={mfaPassword}
                      onChange={(e) => setMfaPassword(e.target.value)}
                      placeholder="Definir ou alterar senha"
                      className="w-full px-4 py-2 rounded-lg bg-liberty-black border border-liberty-black-lighter text-white mb-2"
                    />
                    <input
                      type="password"
                      value={mfaPasswordConfirm}
                      onChange={(e) => setMfaPasswordConfirm(e.target.value)}
                      placeholder="Confirmar senha"
                      className="w-full px-4 py-2 rounded-lg bg-liberty-black border border-liberty-black-lighter text-white mb-2"
                    />
                    <button
                      onClick={() => {
                        if (mfaPassword && mfaPassword !== mfaPasswordConfirm) {
                          toast('Senhas não conferem', 'error')
                          return
                        }
                        if (mfaPassword) updateUser({ password: mfaPassword })
                        setMfaPassword('')
                        setMfaPasswordConfirm('')
                        toast('Senha salva!')
                      }}
                      className="px-4 py-2 rounded-lg border border-liberty-yellow text-liberty-yellow hover:bg-liberty-yellow/10"
                    >
                      Salvar senha
                    </button>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Hardware ID (HWID)</label>
                    <input
                      type="text"
                      value={currentUser?.hwid || 'Não vinculado'}
                      readOnly
                      className="w-full px-4 py-2 rounded-lg bg-liberty-black border border-liberty-black-lighter text-gray-500 mb-2"
                    />
                    <button
                      onClick={() => {
                        updateUser({ hwid: 'device-' + uuid().slice(0, 8) })
                        toast('Dispositivo vinculado!')
                      }}
                      className="px-4 py-2 rounded-lg border border-liberty-yellow text-liberty-yellow hover:bg-liberty-yellow/10"
                    >
                      Vincular este dispositivo
                    </button>
                  </div>
                </motion.div>
              )}
              {activePanel === 'appearance' && (
                <motion.div
                  key="appearance"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Tema</label>
                    <div className="flex gap-2">
                      {(['dark', 'amoled', 'light'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => updateSettings({ theme: t })}
                          className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                            settings.theme === t
                              ? 'border-liberty-yellow bg-liberty-yellow/10 text-liberty-yellow'
                              : 'border-liberty-black-lighter text-gray-400 hover:border-liberty-yellow/50'
                          }`}
                        >
                          {t === 'dark' ? 'Escuro' : t === 'amoled' ? 'AMOLED' : 'Claro'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Cor de destaque</label>
                    <input
                      type="color"
                      value={settings.accent}
                      onChange={(e) => updateSettings({ accent: e.target.value })}
                      className="w-12 h-12 rounded cursor-pointer border-2 border-liberty-black-lighter"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
