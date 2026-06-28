import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const BUCKET = 'offer-app-bucket';

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? 'sa-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const rawName = url.searchParams.get('filename') || 'projeto.pdf';
    const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const key = `Arquivos/marcenaria/${timestamp}_${safeName}`;

    const buffer = Buffer.from(await request.arrayBuffer());
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: 'application/pdf',
    }));

    return Response.json({ ok: true, key });
  } catch (err) {
    console.error('[S3 salvar-pdf marcenaria] ERRO:', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
