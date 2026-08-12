import fs from 'node:fs';
import path from 'node:path';
import { assertImageFileDimensions, assertImagePerformanceContract, assertIntrinsicImageStyle } from './lib/image-performance-contract.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..');
const outputRoot = path.join(repoRoot, '_site');
const image = (src, alt, width, height, options = {}) => ({
  src, alt, class: options.class ?? 'image-intrinsic', width: String(width), height: String(height), decoding: 'async',
  loading: options.loading ?? null, fetchpriority: options.fetchpriority ?? null
});
const squareServiceImages = [
  image('image/top1_1.png', 'データ入力サービス', 512, 512),
  image('image/top1_2.png', 'データ集計・分析サービス', 512, 512),
  image('image/top1_3.png', 'スキャニングサービス', 512, 512),
  image('image/top1_4.png', '画像編集・加工サービス', 512, 512)
];
const cases = [
  ['index.html', [
    image('/image/rogo.png', 'アブロードアウトソーシング株式会社のロゴ', 852, 165),
    ...squareServiceImages.map(({ src, alt, width, height }) => image(src, alt, width, height, { loading: 'lazy' })),
    image('image/top2_left.png', '小ロットから大規模案件までの対応', 512, 512, { loading: 'lazy' }),
    image('image/top2_middle.png', '業務フロー標準化のイメージ', 512, 512, { loading: 'lazy' }),
    image('image/top2_right.png', '高品質・高セキュリティなリソース', 512, 512, { loading: 'lazy' }),
    ...['防衛省のロゴ', '電通のロゴ', '東京大学のロゴ', '京都大学のロゴ', '東北大学のロゴ', '弘前大学のロゴ', '中央大学のロゴ', '東京海上日動のロゴ', '三省堂書店のロゴ', 'STCのロゴ'].map((alt, index) => image(`image/c-${String(index).padStart(3, '0')}.png`, alt, 380, 100, { loading: 'lazy' })),
    image('image/ANAB_font.jpg', 'ANAB認証マーク', 354, 149, { loading: 'lazy' })
  ]],
  ['service.html', [
    image('/image/rogo.png', 'アブロードアウトソーシング株式会社のロゴ', 852, 165),
    ...squareServiceImages,
    image('image/data-img2.png', 'SPEED ADのWEBアンケート作成画面', 512, 512),
    image('image/service_61.png', 'テキスト入力サービス', 512, 512),
    image('image/service_71.png', 'テープ起こしサービス', 512, 512),
    image('image/service_51.png', 'サクッと経理サービス', 512, 512)
  ]],
  ['speed-ad.html', [
    image('/image/rogo.png', 'アブロードアウトソーシング株式会社のロゴ', 852, 165),
    image('image/speed-ad-hero-product.png', 'SPEED ADのアンケート作成画面', 1536, 1024, { class: 'speed-ad-hero-product-image image-intrinsic', fetchpriority: 'high' }),
    image('image/speed-ad-steps-flow.png', 'SPEED ADの利用手順', 1942, 809, { class: 'speed-ad-steps-image image-intrinsic', loading: 'lazy' })
  ]],
  ['scan.html', [
    image('/image/rogo.png', 'アブロードアウトソーシング株式会社のロゴ', 852, 165),
    image('image/carousel-pera.jpg', '書類スキャンサービスの詳細へ', 600, 400, { fetchpriority: 'high' }),
    image('image/carousel-big.jpg', '大判スキャンサービスの詳細へ', 600, 400),
    image('image/carousel-film.jpg', 'フィルムスキャンサービスの詳細へ', 600, 400),
    image('image/carousel-micro.jpg', 'マイクロフィルムスキャンサービスの詳細へ', 600, 400),
    image('image/carousel-receipt.jpg', '領収書・レシートスキャンサービスの詳細へ', 600, 400)
  ]]
];

for (const [file, expectations] of cases) {
  assertImagePerformanceContract(fs.readFileSync(path.join(outputRoot, file), 'utf8'), expectations, file);
  for (const expectation of expectations) {
    const relativeImagePath = expectation.src.replace(/^\/+/, '');
    const imagePath = path.resolve(outputRoot, relativeImagePath);
    if (path.relative(outputRoot, imagePath).startsWith('..') || path.isAbsolute(path.relative(outputRoot, imagePath))) {
      throw new Error(`Image path escapes the public root: ${expectation.src}`);
    }
    if (!fs.existsSync(imagePath)) throw new Error(`Expected published image is missing: ${expectation.src}`);
    assertImageFileDimensions(fs.readFileSync(imagePath), expectation.width, expectation.height, expectation.src);
  }
}
for (const file of ['style3.css', 'style.css']) {
  assertIntrinsicImageStyle(fs.readFileSync(path.join(outputRoot, file), 'utf8'), file);
}

console.log(`Image performance contract passed: ${cases.length} generated pages.`);
