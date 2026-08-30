import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET() {
  const requestHeaders = await headers();
  if (!requestHeaders.get('oai-authenticated-user-id')) {
    return Response.json({ message: '需要登入私人 Sites' }, { status: 401 });
  }

  const raw = process.env.FULIAN_TERM11_CORE_ROSTER;
  if (!raw) {
    return Response.json({ message: '正式 8 長資料尚未設定' }, { status: 503 });
  }

  try {
    const parsed = JSON.parse(raw) as {
      schema?: string;
      term?: Record<string, unknown>;
      coreLeaders?: Array<Record<string, unknown>>;
    };
    const coreLeaders = Array.isArray(parsed.coreLeaders)
      ? parsed.coreLeaders.map((leader) => ({
          roleKey: String(leader.roleKey || ''),
          roleName: String(leader.roleName || ''),
          memberName: String(leader.memberName || ''),
        }))
      : [];
    if (
      coreLeaders.length !== 8 ||
      coreLeaders.some((item) => !item.memberName)
    ) {
      throw new Error('invalid roster');
    }

    return Response.json(
      {
        schema: parsed.schema,
        term: parsed.term,
        coreLeaders,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch {
    return Response.json({ message: '正式 8 長資料格式錯誤' }, { status: 503 });
  }
}
