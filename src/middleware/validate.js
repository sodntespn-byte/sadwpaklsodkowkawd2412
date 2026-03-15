import Joi from 'joi';

export const schemas = {
  register: Joi.object({
    username: Joi.string().min(2).max(100).trim().required(),
    email: Joi.string().email().max(255).trim().allow('', null).optional(),
    password: Joi.string().min(0).max(256).allow('').optional(),
  }),
  login: Joi.object({
    username: Joi.string().max(100).trim().required(),
    password: Joi.string().max(256).allow('').optional(),
  }),
  refresh: Joi.object({
    refresh_token: Joi.string().max(2048).optional(),
    token: Joi.string().max(2048).optional(),
    access_token: Joi.string().max(2048).optional(),
  }).or('refresh_token', 'token', 'access_token'),
  messageContent: Joi.object({
    content: Joi.string()
      .min(1)
      .max(64 * 1024)
      .trim()
      .required(),
    author: Joi.string().max(200).trim().allow('').optional(),
    client_id: Joi.string().max(200).trim().allow('').optional(),
  }),
  changePassword: Joi.object({
    current_password: Joi.string().max(256).allow('').optional(),
    new_password: Joi.string().min(6).max(256).trim().required(),
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
