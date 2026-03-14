import { useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../../context/AppContext'

export default function MessageList() {
  const { currentChannel, currentDM, messages, dmMessages } = useApp()
  const endRef = useRef<HTMLDivElement>(null)

  const msgs = currentDM
    ? dmMessages[currentDM.id] || []
    : currentChannel
    ? messages[currentChannel.id] || []
    : []

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs])

  if (msgs.length === 0) {
    const title = currentDM?.username || currentChannel?.name || 'canal'
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-liberty-yellow/20 flex items-center justify-center text-liberty-yellow mb-4">
            <i className="fas fa-comments text-2xl" />
          </div>
          <h2 className="text-xl font-bold text-liberty-yellow mb-1">
            {currentDM ? title : `#${title}`}
          </h2>
          <p className="text-gray-500 text-sm">
            {currentDM ? 'Início da conversa' : 'Este é o início do canal'}
          </p>
        </motion.div>
        <div ref={endRef} />
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {msgs.map((m, i) => (
        <motion.div
          key={m.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="flex gap-3 py-2"
        >
          <div className="w-10 h-10 rounded-full bg-liberty-yellow flex items-center justify-center text-black flex-shrink-0">
            {m.avatar ? (
              <img src={m.avatar} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <i className="fas fa-user text-sm" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-liberty-yellow">{m.author}</span>
              <span className="text-xs text-gray-500">{m.time}</span>
            </div>
            <p className="text-white text-sm break-words">{m.text}</p>
          </div>
        </motion.div>
      ))}
      <div ref={endRef} />
    </div>
  )
}
