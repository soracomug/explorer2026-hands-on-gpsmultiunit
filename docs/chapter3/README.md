# 3: SORACOM Lagoon設定

![architecture](img/architecture.png)

## SORACOM Lagoon3の利用を開始する

公式ドキュメントの[SORACOM Lagoon3の利用を開始する](https://users.soracom.io/ja-jp/docs/lagoon-v3/getting-started/)を参考に、Lagoonの利用を開始します。

プランは「Free」を選択してください。

## IMSIを確認する

GPSマルチユニットで利用しているSIM(GPSトラッカーシミュレーターの場合は仮想SIM)のIMSIを確認します。

SORACOMのユーザーコンソールから、[メニュー] → [SORACOM Air for Cellular] -> [SIM 管理] の順にクリックし、SIM管理画面を表示します。

![SIM管理画面](img/image1.png)

GPS マルチユニットの IoT SIM にチェックを入れて、[詳細] をクリックします。

![SIM管理画面](img/image2.png)

[IMSI] をテキストエディタなどにメモします。

![SIM詳細](img/image3.png)

## サンプルダッシュボードの準備をする

[GPSマルチユニットサンプルダッシュボード](https://try.soracom.io/lagoon-gallery/gps-multiunit-sample) にアクセスし、[このダッシュボードを使う] をクリックします。

![GPSマルチユニットサンプルダッシュボード](img/image4.png)

先ほどメモしたIMSIを入力し、「テンプレートを作成する」  

![IMSIの入力](img/image5.png)

「クリップボードにコピー」をクリックし、「SORACOM Lagoonでインポート」をクリックします。

![クリップボードにコピー](img/image6.png)

## Lagoonにインポートする

先ほどボタンをクリックすると、Lagoonのログイン画面が表示されます。  
SORACOM ユーザーコンソールのルートユーザーのメールアドレスと、「SORACOM Lagoon 3 の利用を開始する」で設定したパスワードを入力します。

ログインに成功すると、import画面が表示されます。「import via pane json」にクリップボードの中身を貼り付け、「Load」ボタンをクリックします。

![import画面](img/image7.png)

確認画面で「Soracom」のプルダウンメニューで「Soracom(default)」を選び、「import」ボタンをクリックします。

![確認画面](img/image8.png)

エラーが表示されますが無視します。

左の柱の上から3番目のアイコンをクリックし、「Dashboards」をクリックします。  
「GPSマルチユニットサンプルダッシュボード」が表示されるので、これをクリックします。

![Dashboards](img/image9.png)

サンプルダッシュボードが表示されたら成功です。

![サンプルダッシュボード](img/image10.png)

---

- 次: [4: 中・上級者向け追加コンテンツ](../chapter4/README.md)  
99: [後片付け](../chapter99/README.md)

- 前: [2: GPSマルチユニット初期設定(ガジェット設定〜Harvest動作確認)](../chapter2/README.md)
