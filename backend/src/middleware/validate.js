import Joi from 'joi';

/** Comprimentos máximos alinhados ao backend (segurança e schema). */
const MAX_MESSAGE = 64 * 1024;
const MAX_USERNAME = 100;
const MAX_SERVER_NAME = 100;
const MAX_CHANNEL_NAME = 100;
const MAX_BAN_REASON = 500;

export const schemas = {
  register: Joi.object({
    username: Joi.string().min(2).max(MAX_USERNAME).trim().required(),
    email: Joi.string().email().max(255).trim().allow('', null).optional(),
    password: Joi.string().min(0).max(256).allow('').optional(),
  }),
  login: Joi.object({
    username: Joi.string().max(MAX_USERNAME).trim().required(),
    password: Joi.string().max(256).allow('').optional(),
  }),
  refresh: Joi.object({
    refresh_token: Joi.string().max(2048).optional(),
    token: Joi.string().max(2048).optional(),
    access_token: Joi.string().max(2048).optional(),
  }).or('refresh_token', 'token', 'access_token'),
  /** content obrigatório; author/client_id ignorados no servidor — utilizador vem sempre do JWT (req.userId). */
  messageContent: Joi.object({
    content: Joi.string().min(1).max(MAX_MESSAGE).trim().required(),
    author: Joi.string().max(200).strip().optional(),
    client_id: Joi.string().max(200).trim().allow('').optional(),
  }),
  changePassword: Joi.object({
    current_password: Joi.string().max(256).allow('').optional(),
    new_password: Joi.string().min(6).max(256).trim().required(),
  }),
  patchServer: Joi.object({
    name: Joi.string().max(MAX_SERVER_NAME).trim().allow('').optional(),
    icon: Joi.string().max(2 * 1024 * 1024).allow('').optional(),
  }),
  createChannel: Joi.object({
    name: Joi.string().min(1).max(MAX_CHANNEL_NAME).trim().required(),
    type: Joi.string().valid('text', 'voice', 'category').optional(),
    parent_id: Joi.string().uuid({ version: 'uuidv4' }).allow('', null).optional(),
  }),
  serverBan: Joi.object({
    user_id: Joi.string().uuid({ version: 'uuidv4' }).required(),
    reason: Joi.string().max(MAX_BAN_REASON).trim().allow('', null).optional(),
  }),
  patchMemberRole: Joi.object({
    role: Joi.string().valid('member', 'moderator', 'admin').required(),
  }),
  callStart: Joi.object({
    callee_id: Joi.string().uuid({ version: 'uuidv4' }).required(),
    chat_id: Joi.string().uuid({ version: 'uuidv4' }).allow('', null).optional(),
  }),
  callStatus: Joi.object({
    status: Joi.string().valid('ringing', 'active', 'ended', 'rejected', 'missed').required(),
  }),
  relationshipAdd: Joi.object({
    username: Joi.string().min(1).max(MAX_USERNAME).trim().required(),
  }),
};

export function validateBody(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body || {}, { stripUnknown: true });
    if (error) {
      return res.status(400).json({ message: error.details.map(d => d.message).join('; ') });
    }
    req.body = value;
    next();
  };
}
