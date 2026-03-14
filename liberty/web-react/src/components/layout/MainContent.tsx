import { motion } from 'framer-motion'
import { useApp } from '../../context/AppContext'
import MessageList from './MessageList'
import MessageInput from './MessageInput'

export default function MainContent() {
  const { currentChannel, currentDM } = useApp()

  const channelName = currentDM?.username || currentChannel?.name || 'geral'
  const placeholder = currentDM
    ? `Enviar mensagem para ${currentDM.username}...`
    : currentChannel
    ? `Enviar mensagem em #${currentChannel.name}...`
    : 'Enviar mensagem...'

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-liberty-black">
      <div className="h-12 px-4 flex items-center justify-between border-b border-liberty-black-lighter flex-shrink-0">
        <div className="flex items-center gap-2">
          <i className={`fas fa-${currentDM ? 'at' : 'hashtag'} text-gray-500`} />
          <span className="font-semibold text-white">{channelName}</span>
        </div>
        <div className="flex gap-1">
          {['phone', 'video', 'thumbtack', 'users', 'user-plus'].map((icon) => (
            <button
              key={icon}
              className="w-8 h-8 rounded flex items-center justify-center hover:bg-liberty-black-lighter text-gray-400 hover:text-white transition-colors"
            >
              <i className={`fas fa-${icon}`} />
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {!currentChannel && !currentDM ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col items-center justify-center p-8 text-center"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="w-20 h-20 rounded-full bg-liberty-yellow flex items-center justify-center text-black mb-6 shadow-[0_0_30px_rgba(255,255,0,0.4)]"
            >
              <i className="fas fa-comments text-3xl" />
            </motion.div>
            <h2 className="text-2xl font-bold text-liberty-yellow mb-2">Bem-vindo</h2>
            <p className="text-gray-400">Selecione um canal ou amigo para começar</p>
          </motion.div>
        ) : (
          <MessageList />
        )}
      </div>

      <MessageInput placeholder={placeholder} />

      <div className="px-4 py-2 border-t border-liberty-black-lighter flex items-center gap-2 text-sm text-gray-500 flex-shrink-0">
        <i className="fas fa-shield-alt" />
        <span>Criptografia ponta-a-ponta</span>
      </div>
    </div>
  )
}
