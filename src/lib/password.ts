import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 10;

/**
 * 将明文密码哈希为 bcrypt 字符串。
 * 用于注册和修改密码场景。
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/**
 * 验证明文密码与哈希是否匹配。
 * 同时兼容旧数据中的明文密码（不以 $2a$/$2b$ 开头的视为明文）。
 * 当检测到明文命中时返回 { match: true, needsRehash: true }，
 * 调用方应在验证通过后将密码升级为哈希存储。
 */
export async function verifyPassword(
  plain: string,
  stored: string,
): Promise<{ match: boolean; needsRehash: boolean }> {
  // bcrypt 哈希固定以 $2a$ 或 $2b$ 开头，长度 60
  const isBcrypt = /^\$2[ab]\$\d{2}\$.{53}$/.test(stored);

  if (isBcrypt) {
    const match = await bcrypt.compare(plain, stored);
    return { match, needsRehash: false };
  }

  // 旧数据：明文比对
  const match = stored === plain;
  return { match, needsRehash: match };
}
