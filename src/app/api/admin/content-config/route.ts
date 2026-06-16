import { PERMISSIONS, requireAllPermissions } from '@/core/rbac';
import { locales } from '@/config/locale';
import {
  getLocalizedContentConfigKey,
  HOMEPAGE_FAQ_CONFIG_KEY,
  MIRROR_FAQ_CONFIG_KEY,
  normalizeFaqContentConfig,
  normalizeUpgradeNoticeConfig,
  UPGRADE_NOTICE_CONFIG_KEY,
} from '@/shared/lib/content-config';
import { respData, respErr } from '@/shared/lib/resp';
import { saveContentConfigValues } from '@/shared/models/content-config';

export async function POST(req: Request) {
  try {
    await requireAllPermissions({
      codes: [PERMISSIONS.POSTS_READ, PERMISSIONS.POSTS_WRITE],
    });
  } catch {
    return respErr('无权限');
  }

  try {
    const body = await req.json();
    const locale = typeof body.locale === 'string' ? body.locale : '';
    const payload = body.payload;

    if (!locales.includes(locale)) {
      return respErr('不支持的语言');
    }

    if (!payload) {
      return respErr('缺少内容配置');
    }

    const homepageFaqConfig = normalizeFaqContentConfig(
      payload.homepageFaqConfig
    );
    const mirrorFaqConfig = normalizeFaqContentConfig(payload.mirrorFaqConfig);
    const noticeConfig = normalizeUpgradeNoticeConfig(
      payload.upgradeNoticeConfig
    );

    await saveContentConfigValues({
      [getLocalizedContentConfigKey(HOMEPAGE_FAQ_CONFIG_KEY, locale)]:
        JSON.stringify(homepageFaqConfig),
      [getLocalizedContentConfigKey(MIRROR_FAQ_CONFIG_KEY, locale)]:
        JSON.stringify(mirrorFaqConfig),
      [getLocalizedContentConfigKey(UPGRADE_NOTICE_CONFIG_KEY, locale)]:
        JSON.stringify(noticeConfig),
    });

    return respData({ message: '内容配置已保存' });
  } catch (error) {
    return respErr(
      error instanceof Error ? error.message : '内容配置保存失败，请稍后重试'
    );
  }
}
