# データ構造定義書: SpeedAd - アンケート管理ダッシュボード

## 1. 概要

このドキュメントは、「SpeedAd - アンケート管理ダッシュボード」で使用される主要なデータオブジェクトの構造を定義します。
現在は静的JSONファイルやJavaScriptオブジェクトをデータソースとしていますが、将来的なAPI化を見据え、各データ項目の仕様を明確にすることを目的とします。

## 2. アンケートオブジェクト (`Survey`)

アンケート単体を表すオブジェクトです。主に `data/surveys.json` に格納されます。

| プロパティ名 | データ型 | 必須 | 説明 | 例 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | String | ✅ | アンケートの一意な識別子。システム全体でユニークである必要があります。 | `"sv_20250715_001"` |
| `groupId` | String | ✅ | アンケートを作成したグループのIDです。 | `"GROUP001"` |
| `name` | String | ✅ | 社内管理用のアンケート名。一覧画面で主に見える名称です。 | `"【東京】機械要素技術展2025"` |
| `displayTitle` | String | ✅ | アンケート回答画面で、回答者に対して表示される正式なタイトルです。 | `"ご来場いただき誠にありがとうございます！"` |
| `status` | String | ✅ | アンケートの現在の状態を示します。この値によって一覧での表示や可能な操作が変化します。 | `"会期中"` |
| `plan` | String | ⬜️ | 契約されているプラン名。機能制限などに関わる可能性があります。（例: `"Standard"`, `"Premium"`, `"Free"`) | `"Standard"` |
| `memo` | String | ⬜️ | このアンケートに関する社内向けの自由記述メモです。 | `"〇〇社からの紹介案件。特別対応が必要。"` |
| `periodStart` | String | ✅ | 回答受付期間の開始日です。フォーマットは `YYYY-MM-DD` とします。 | `"2025-07-15"` |
| `periodEnd` | String | ✅ | 回答受付期間の終了日です。フォーマットは `YYYY-MM-DD` とします。 | `"2025-07-17"` |
| `answerCount` | Number | ✅ | 確定済みの総回答数です。 | `125` |
| `realtimeAnswers` | Number | ⬜️ | 会期中などに追加された、まだ完全に確定していない速報的な回答数です。 | `12` |
| `dataCompletionDate` | String | ⬜️ | 名刺データ化サービスを利用した場合の、データ化完了予定日または完了日です。 | `"2025-07-20"` |
| `deadline` | String | ⬜️ | データダウンロードや各種操作が可能な期限日です。 | `"2025-08-31"` |
| `estimatedBillingAmount` | Number | ⬜️ | このアンケートに関する概算の請求金額です。 | `50000` |
| `bizcardEnabled` | Boolean | ✅ | 名刺データ化サービスを利用するかどうかのフラグです。 | `true` |
| `bizcardRequest` | Number | ⬜️ | 名刺データ化の依頼枚数です。`bizcardEnabled`が`true`の場合に意味を持ちます。`0`は未依頼またはデータ化なしを示します。 | `100` |
| `bizcardCompletionCount`| Number | ⬜️ | データ化が完了した名刺の枚数です。`bizcardEnabled`が`true`の場合に意味を持ちます。デフォルトは`100`です。 | `100` |
| `thankYouEmailSettings` | String | ⬜️ | サンクスメールの設定状況を示します。（例: `"設定済み"`, `"未設定"`, `"送信完了"`） | `"設定済み"` |

---

## 3. ユーザーオブジェクト (`User`)

ログインしているユーザーの情報を表すオブジェクトです。`accountInfoModal` などで利用されます。

| プロパティ名 | データ型 | 必須 | 説明 |
| :--- | :--- | :--- | :--- |
| `email` | String | ✅ | ログインIDとなるメールアドレスです。 |
| `companyName` | String | ⬜️ | ユーザーが所属する会社名です。 |
| `departmentName` | String | ⬜️ | 部署名です。 |
| `positionName` | String | ⬜️ | 役職名です。 |
| `lastName` | String | ✅ | 姓。 |
| `firstName` | String | ✅ | 名。 |
| `phoneNumber` | String | ✅ | 連絡先電話番号です。 |
| `postalCode` | String | ✅ | 郵便番号です（ハイフン含む・含まないは別途規定）。 |
| `address` | String | ✅ | 住所（都道府県、市区町村、番地）。 |
| `buildingFloor` | String | ⬜️ | 建物名、部屋番号など。 |
| `billingAddressType`| String | ✅ | 請求先情報の種類。`"same"`（上記と同じ）または `"different"`（異なる）のいずれか。 |
| `billingCompanyName`| String | ⬜️ | `billingAddressType`が`different`の場合の請求先会社名。 |
| `billingDepartmentName`| String | ⬜️ | `billingAddressType`が`different`の場合の請求先部署名。 |
| `billingLastName` | String | ⬜️ | `billingAddressType`が`different`の場合の請求先担当者（姓）。 |
| `billingFirstName` | String | ⬜️ | `billingAddressType`が`different`の場合の請求先担当者（名）。 |
| `billingPhoneNumber`| String | ⬜️ | `billingAddressType`が`different`の場合の請求先電話番号。 |
| `billingPostalCode` | String | ⬜️ | `billingAddressType`が`different`の場合の請求先郵便番号。 |
| `billingAddress` | String | ⬜️ | `billingAddressType`が`different`の場合の請求先住所。 |
| `billingBuildingFloor`| String | ⬜️ | `billingAddressType`が`different`の場合の請求先建物名など。 |

---

## 4. グループオブジェクト (`Group`)

ユーザーが所属するグループの情報を表すオブジェクトです。`newGroupModal` などで利用されます。

| プロパティ名 | データ型 | 必須 | 説明 |
| :--- | :--- | :--- | :--- |
| `id` | String | ✅ | グループの一意な識別子。 |
| `name` | String | ✅ | グループ名。 |
| `description` | String | ⬜️ | グループの目的などを示す説明文。 |
| `members` | Array<Member> | ✅ | このグループに所属するメンバーのリスト。下記 `Member` オブジェクトの配列です。 |

### 4.1. メンバーオブジェクト (`Member`)

`Group` オブジェクトの `members` プロパティに含まれる、個々のメンバーを表すオブジェクトです。

| プロパティ名 | データ型 | 必須 | 説明 |
| :--- | :--- | :--- | :--- |
| `email` | String | ✅ | メンバーのメールアドレス。 |
| `role` | String | ✅ | メンバーの役割（権限）。`"admin"`（管理者）または `"member"`（一般メンバー）のいずれか。 |
