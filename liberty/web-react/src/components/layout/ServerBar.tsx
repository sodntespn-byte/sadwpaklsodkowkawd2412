import { motion } from 'framer-motion'
import { useApp } from '../../context/AppContext'

interface Props {
  onAddServer: () => void
}

export default function ServerBar({ onAddServer }: Props) {
  const { servers, currentServer, selectServer, goHome } = useApp()

  return (
    <div className="w-[72px] bg-liberty-black-soft flex flex-col items-center py-3 gap-2 flex-shrink-0">
      <motion.button
        onClick={goHome}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`w-12 h-12 rounded-2xl flex items-center justify-center cursor-pointer transition-colors ${
          !currentServer ? 'bg-liberty-yellow text-black rounded-[24px]' : 'bg-liberty-black-light hover:bg-liberty-yellow hover:text-black'
        }`}
      >
        <img src="/assets/logo.png" alt="Home" className="w-8 h-8" />
      </motion.button>

      <div className="w-8 h-0.5 bg-liberty-black-lighter rounded" />

      {servers.map((server) => (
        <motion.button
          key={server.id}
          onClick={() => selectServer(server.id)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center cursor-pointer transition-all overflow-hidden ${
            currentServer?.id === server.id
              ? 'bg-liberty-yellow text-black rounded-[24px]'
              : 'bg-liberty-black-light hover:bg-liberty-yellow hover:text-black'
          }`}
        >
          {server.icon ? (
            <img src={server.icon} alt={server.name} className="w-full h-full object-cover" />
          ) : (
            <span className="font-bold text-sm">{server.name[0].toUpperCase()}</span>
          )}
        </motion.button>
      ))}

      <motion.button
        onClick={onAddServer}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="w-12 h-12 rounded-2xl bg-liberty-black-light hover:bg-liberty-yellow hover:text-black flex items-center justify-center cursor-pointer transition-colors"
      >
        <i className="fas fa-plus" />
      </motion.button>
    </div>
  )
}
