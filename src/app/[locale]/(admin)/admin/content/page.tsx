import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PERMISSIONS, requireAllPermissions } from '@/core/rbac';
import {
  ContentConfigEditor,
  type ContentConfigEditorPayload,
} from '@/shared/blocks/admin/content-config-editor';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import {
  getContentConfigValue,
  getDefaultUpgradeNoticeConfig,
  HOMEPAGE_FAQ_CONFIG_KEY,
  MIRROR_FAQ_CONFIG_KEY,
  resolveFaqContentConfigForAdmin,
  resolveUpgradeNoticeConfigForAdmin,
  UPGRADE_NOTICE_CONFIG_KEY,
} from '@/shared/lib/content-config';
import { getContentConfigValuesStrict } from '@/shared/models/content-config';
import { Crumb } from '@/shared/types/blocks/common';
import { DynamicPage, FAQ } from '@/shared/types/blocks/landing';

export default async function AdminContentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requireAllPermissions({
    codes: [PERMISSIONS.POSTS_READ, PERMISSIONS.POSTS_WRITE],
    redirectUrl: '/admin/no-permission',
    locale,
  });

  const t = await getTranslations('admin.settings');
  const homePageTranslations = await getTranslations('pages.index');
  const mirrorPageTranslations = await getTranslations('pages.chatgpt-mirror');
  const homePage: DynamicPage = homePageTranslations.raw('page');
  const mirrorPage: DynamicPage = mirrorPageTranslations.raw('page');
  let initialValue: ContentConfigEditorPayload | null = null;
  let loadError = '';

  try {
    const contentConfigs = await getContentConfigValuesStrict();

    initialValue = {
      homepageFaqConfig: resolveFaqContentConfigForAdmin(
        getContentConfigValue(contentConfigs, HOMEPAGE_FAQ_CONFIG_KEY, locale),
        homePage.sections?.faq as FAQ,
        '首页 FAQ'
      ),
      mirrorFaqConfig: resolveFaqContentConfigForAdmin(
        getContentConfigValue(contentConfigs, MIRROR_FAQ_CONFIG_KEY, locale),
        mirrorPage.sections?.faq as FAQ,
        '镜像页 FAQ'
      ),
      upgradeNoticeConfig: resolveUpgradeNoticeConfigForAdmin(
        getContentConfigValue(
          contentConfigs,
          UPGRADE_NOTICE_CONFIG_KEY,
          locale
        ),
        getDefaultUpgradeNoticeConfig(),
        '升级流程弹窗'
      ),
    };
  } catch (error) {
    loadError =
      error instanceof Error
        ? error.message
        : '内容配置读取失败，已停止载入以避免覆盖现有配置';
  }

  const crumbs: Crumb[] = [
    { title: t('edit.crumbs.admin'), url: '/admin' },
    { title: '站点内容', is_active: true },
  ];

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        <MainHeader title="站点内容配置" />
        {loadError ? (
          <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border p-5 text-sm leading-6">
            <p className="font-medium">内容配置读取失败，暂不允许保存。</p>
            <p className="mt-2">{loadError}</p>
            <p className="text-muted-foreground mt-2">
              请检查数据库连接或现有配置 JSON，修复后刷新页面再编辑。
            </p>
          </div>
        ) : initialValue ? (
          <ContentConfigEditor initialValue={initialValue} locale={locale} />
        ) : null}
      </Main>
    </>
  );
}
