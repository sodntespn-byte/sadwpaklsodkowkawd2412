import { motion } from 'framer-motion'
import { useApp } from '../../context/AppContext'

export default function MemberBar() {
  const { currentUser, currentServer } = useApp()
  const members = currentServer?.members || (currentUser ? [currentUser] : [])

  return (
    <div className="w-60 bg-liberty-black-light flex flex-col flex-shrink-0 border-l border-liberty-black-lighter">
      <div className="h-12 px-4 flex items-center border-b border-liberty-black-lighter">
        <span className="text-sm font-medium text-gray-400">
          Membros — <span className="text-white">{members.length}</span>
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        <div className="text-xs font-semibold text-gray-500 uppercase px-2 py-1 mb-2">
          Online — {members.length}
        </div>
        {members.map((m) => (
          <motion.div
            key={m.id}
            whileHover={{ backgroundColor: 'rgba(255,255,0,0.05)' }}
            className="flex items-center gap-3 px-2 py-2 rounded cursor-pointer"
          >
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-liberty-yellow flex items-center justify-center text-black">
                {m.avatar ? (
                  <img src={m.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <i className="fas fa-user text-xs" />
                )}
              </div>
              <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-green-500 border-2 border-liberty-black-light" />
            </div>
            <span className="text-sm text-white truncate">{m.username}</span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
