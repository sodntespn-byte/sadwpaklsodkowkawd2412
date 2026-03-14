import { useState } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../../context/AppContext'

interface Props {
  onSettings: () => void
}

export default function ChannelBar({ onSettings }: Props) {
  const { currentUser, currentServer, currentChannel, currentDM, friends, selectChannel, goHome, openDM } = useApp()
  const [search, setSearch] = useState('')
  const [showFriends, setShowFriends] = useState(false)

  const title = currentServer?.name || 'Mensagens Diretas'
  const channelName = currentDM?.username || currentChannel?.name || 'geral'

  return (
    <div className="w-60 bg-liberty-black-light flex flex-col flex-shrink-0">
      <div className="h-12 px-4 flex items-center justify-between border-b border-liberty-black-lighter">
        <span className="font-semibold text-white truncate">{title}</span>
        <button
          onClick={onSettings}
          className="w-8 h-8 rounded flex items-center justify-center hover:bg-liberty-black-lighter text-gray-400 hover:text-white transition-colors"
        >
          <i className="fas fa-cog" />
        </button>
      </div>

      <div className="p-2 border-b border-liberty-black-lighter">
        <div className="flex items-center gap-2 px-3 py-2 bg-liberty-black rounded-md">
          <i className="fas fa-search text-gray-500 text-sm" />
          <input
            type="text"
            placeholder="Pesquisar"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {!currentServer ? (
          <div className="px-2">
            <div className="flex items-center justify-between px-2 py-1 mb-1">
              <span className="text-xs font-semibold text-gray-500 uppercase">Mensagens Diretas</span>
              <button className="w-6 h-6 rounded flex items-center justify-center hover:bg-liberty-black-lighter text-gray-400 hover:text-liberty-yellow transition-colors">
                <i className="fas fa-plus text-xs" />
              </button>
            </div>
            <motion.div
              onClick={() => setShowFriends(true)}
              whileHover={{ backgroundColor: 'rgba(255,255,0,0.1)' }}
              className={`flex items-center gap-3 px-2 py-2 rounded cursor-pointer ${
                showFriends ? 'bg-liberty-black-lighter text-liberty-yellow' : 'text-gray-300'
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-liberty-black-lighter flex items-center justify-center">
                <i className="fas fa-users text-sm" />
              </div>
              <span>Amigos</span>
            </motion.div>
          </div>
        ) : (
          <div className="px-2">
            <div className="px-2 py-1 mb-1">
              <span className="text-xs font-semibold text-gray-500 uppercase">Canais de Texto</span>
            </div>
            {currentServer.channels
              .filter((c) => c.type === 'text')
              .map((ch) => (
                <motion.div
                  key={ch.id}
                  onClick={() => selectChannel(ch.id)}
                  whileHover={{ backgroundColor: 'rgba(255,255,0,0.1)' }}
                  className={`flex items-center gap-2 px-2 py-2 rounded cursor-pointer ${
                    currentChannel?.id === ch.id ? 'bg-liberty-black-lighter text-liberty-yellow' : 'text-gray-300'
                  }`}
                >
                  <i className="fas fa-hashtag text-sm text-gray-500" />
                  <span>{ch.name}</span>
                </motion.div>
              ))}
          </div>
        )}
      </div>

      <div className="p-2 border-t border-liberty-black-lighter">
        <div className="flex items-center gap-3 px-2 py-2 rounded bg-liberty-black">
          <div className="w-8 h-8 rounded-full bg-liberty-yellow flex items-center justify-center text-black">
            {currentUser?.avatar ? (
              <img src={currentUser.avatar} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <i className="fas fa-user text-sm" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-white truncate">{currentUser?.username}</div>
            <div className="text-xs text-gray-500 truncate">{currentUser?.tag}</div>
          </div>
          <div className="flex gap-1">
            <button className="w-8 h-8 rounded flex items-center justify-center hover:bg-liberty-black-lighter text-gray-400 hover:text-white transition-colors">
              <i className="fas fa-microphone text-sm" />
            </button>
            <button className="w-8 h-8 rounded flex items-center justify-center hover:bg-liberty-black-lighter text-gray-400 hover:text-white transition-colors">
              <i className="fas fa-headphones text-sm" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
