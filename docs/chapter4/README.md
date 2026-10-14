# 4: IoT Core設定～Location Service設定～動作確認

![architecture](img/architecture.png)

AWS コンソールから、Amazon Location Service の設定を行います。
まず、IoT Core から Location Service へのデータルーティングを設定します。

## IoT Coreのルーティングを設定する

IoT Core のルーティングを以下の手順で設定します。
サービスの検索窓に“iot”と入力し、表示されたサービスから “IoT Core” を選びます。

![IoT Coreの選択](../chapter3/img/image15.png)

左のメニューの"管理">"メッセージのルーティング">"ルールの作成"をクリックします。

![ルールの作成](img/image1.png)

ルール名に`gps_multiunit_handson`と入力し、「次へ」をクリックします。

![ルール名の入力](img/image2.png)

SQLのバージョンは`2016-03-23`を選択し、SQLステートメントに`SELECT * FROM 'GPSMultiUnitHandson'`と入力し、「次へ」をクリックします。

![SQLステートメントの入力](img/image3.png)

アクション1で”場所”を選び、”トラッカーを作成”をクリックします

![トラッカーを作成](img/image4.png)

トラッカーの名前に`GPSMultiUnitHandson`と入力し、”位置のフィルタリング”は”精度ベースのフィルタリング”を選び、”トラッカーを作成"をクリックします。

![トラッカーの設定](img/image5.png)

ルールアクションの設定ページに戻り、トラッカー名の横のリロードボタンをクリックして、先ほど作ったトラッカー名を選択します。

デバイスIDに半角英数字であなたのGPSマルチユニットを表す名前を入れます。これが後ほど通知内容に表示されます。他の人のデータと区別できるように分かりやすい名前を入れてください。
経度に`${payloads.lon}`、緯度に`${payloads.lat}`、タイムスタンプの値に`${timestamp()}`と入力します。タイムスタンプの単位は`MILLISECONDS`を選択します。

IAMロールの横の"新しいロールを作成"をクリックします。

![IAMロールの作成](img/image6.png)

ロール名に`GPSMultiUnitHandson`と入れて"作成"をクリックします

![IAMロール名の入力](img/image7.png)

作成したロール名が選択されているのを確認し、"表示"をクリックします

![ロールの表示](img/image8.png)

IAMロールの画面が別タブで開くので、"許可を追加">"インラインポリシーを作成"をクリックします

![インラインポリシーの作成](img/image9.png)

ポリシーエディッタの“サービス選択"で"Location"を選び、"アクション許可"で`BatchUpdateDevicePosition`を選択します。
"リソース"で"特定"を選び、"ARNを追加"をクリックします。

![ARNの追加](img/image10.png)

"次のリソース"で"このアカウント"を選び、"任意のリージョン"にチェックを入れ、Resource tracker nameに`GPSMultiUnitHandson`と入力して"ARNを追加"をクリックします。

![ARNの設定](img/image11.png)

ARNが追加されたら"次へ"をクリックします。

![ARNの確認](img/image12.png)

"ポリシー名"に`GPSMultiUnitHandsonLocationPolicy`と入力し、"ポリシーの作成"をクリックします

![ポリシーの作成](img/image13.png)

ルールアクションの設定ページに戻り、"次へ"をクリックします

確認ページで"作成"をクリックします

![ルールの作成完了](img/image14.png)

## ジオフェンスの設定をする

![architecture2](img/architecture2.png)

以下の手順で Location Service のジオフェンスを準備します。
AWS コンソールの検索窓に”location”と入力し、表示されたサービスから"Amazon Location Service”を選択します。

![Location Serviceの選択](img/image15.png)

左上の三点リーダーをクリックしてメニューを開きます。

“ジオフェンス"をクリックします。

本日の会場を表すジオフェンス(地図の区域)を作ります。
"ジオフェンスコレクションを作成"をクリックします。

![ジオフェンスコレクションの作成](img/image16.png)

名前に`GPSMultiUnitHandson`と入力し、"CloudWatch をターゲットとする EventBridge ルール - オプション"は"はい、CloudWatch をターゲットとする EventBridge ルールを作成します"を選択します。

"ジオフェンスコレクションを作成"をクリックします。

![ジオフェンスコレクションの作成完了](img/image17.png)

作成したジオフェンスコレクションで"ジオフェンスを追加"をクリックします。

![ジオフェンスの追加](img/image18.png)

GeoJSONという形式のファイルをアップロードします。

![JSONのアップロード](img/image19.png)

GeoJSON は [geojson.io](http://geojson.io/) を使って作ることもできますが、今回は運営が準備したファイルを以下からダウンロードして使ってください。
以下のように、建物を囲ったGeoJSONを準備しています。

![会場を囲ったGeoJSON](img/geojson.png)

以下のファイルをダウンロードしてください。

[oec.json](../../src/oec.json)

左のメニューで"トラッカー"をクリックします。

”マイトラッカー”に先ほど作成したトラッカーが表示されているので、名前をクリックします。

![トラッカーの選択](img/image20.png)

"ジオフェンスコレクションをリンク"をクリックします。

![ジオフェンスコレクションのリンク](img/image21.png)

先ほど作成したジオフェンスコレクションを選択し、"リンク"をクリックします。

![ジオフェンスコレクションのリンク完了](img/image22.png)

## 動作確認(1)

ここで一度、動作確認します。
AWSコンソールの検索窓に”event"と入力し、表示されたサービスの一覧から"EventBridge"をクリックします。

![EventBridgeサービスの選択](img/image23.png)

左のメニューの"ルール"をクリックすると、先ほどジオフェンスを作成した際に作成されたルールがあるのでこれをクリックします。

![EventBridgeルール一覧](img/image24.png)

"ターゲット"タブをクリックし、表示されたターゲット名をクリックします。

![EventBridgeターゲットタブ](img/image25.png)

クリックすると以下のようにCloudWatchロググループが表示されます。

![CloudWatchロググループの表示](img/image26.png)

イベントが発生 (ジオフェンシングの範囲に GPS マルチユニットが出たり入ったり) すると、こちらのログストリームにイベント内容が出力されます。  
GPSマルチユニットの位置がジオフェンシングの中や外にあるかのように、手動で位置情報を IoT Core に送ってみます。  
CloudWatchロググループのページを開いたまま、ブラウザの別のタブでAWSコンソールのIoT Coreのページへ移動します。  
AWSコンソールにアクセスし、サービスの検索窓に“iot”と入力し、表示されたサービスから “IoT Core” を選びます。

![IoT Coreサービスの選択](img/image27.png)

左のメニューの"テスト">"MQTTテストクライアント"をクリックし、"トピックのフィルター"に`GPSMultiUnitHandson`と入力し、"サブスクライブ"をクリックします。

![MQTTテストクライアントの設定](img/image28.png)

先ほど確認したのと同じように、しばらく待っているとここにGPSマルチユニットから送信されるデータ(JSON)が表示されますのでそれをコピーしておきます。

![MQTTテストクライアントでのデータ受信](img/image29.png)

画面上部の"メッセージペイロード"に先ほどコピーしたJSONを貼り付けます。

貼り付けたJSONのなかの”lat:”と”lon:”の部分に以下のデータを入れ、"発行"をクリックしてください。ジオフェンスの中と外の2つのデータがあるので、交互に発行することでジオフェンスに入った状態と出た状態を作ることができます。

ジオフェンスの中

```json
"lat": 33.24319342713308,
"lon": 131.59888873499483,
```

![image30](img/image30.png)

ジオフェンスの外

```json
"lat":33.24280832627794,
"lon": 131.5994303034214,
```

![image31](img/image31.png)

CloudWatchロググループを再読込してみて、ログストリームが表示されていたら、ログストリーム名をクリックします。

![image32](img/image32.png)

以下のようにログが出ていれば成功です。以下の例では”EventType”が”ENTER”になってるので、ジオフェンスの中に入ったというイベントになります。

![image33](img/image33.png)

CloudWatch Logs でジオフェンスのイベントが確認できなかった時のトラブルシューティング

IoT Core → Location Service → EventBridge → CloudWatch Logs というパイプラインになっているため、Location Service のトラッカーにデータが到達しているかを確認します。

AWSコンソール右上、検索窓の右側にあるアイコンをクリックしてCloudShellを起動します。

![image34](img/image34.png)

以下のように、AWSコンソールの下の方にCloudShellのターミナル(コマンドを入力できる画面)が表示されます。

![image35](img/image35.png)

CloudShellに以下のコマンドを入力します。

```bash
aws --region ap-northeast-1 location get-device-position --device-id "あなたの設定したデバイスID" --tracker-name "GPSMultiUnitHandson"
```

![image36](img/image36.png)

以下のように、現在登録された位置情報が表示されれば、データは正しくトラッカーまで届いています。

届いていない場合、IoT Coreのルーティングの設定を間違えている可能性がありますので確認してください。  
デバイスのIDを間違えている可能性もあります。トラッカーの中の全てのデバイスの位置情報を出力するには以下のコマンドを入力します。

```bash
aws --region ap-northeast-1 location list-device-positions --tracker-name "GPSMultiUnitHandson"
```

![image37](img/image37.png)

位置情報の登録履歴を見るには以下のコマンドを入力します。

```bash
aws --region ap-northeast-1 location get-device-position-history --device-id "あなたのデバイスID" --tracker-name "GPSMultiUnitHandson" --start-time-inclusive "2023-11-03T00:00:00.000Z" --end-time-exclusive "2023-11-05T23:59:59.000Z"
```

![image38](img/image38.png)

CloudShellを終了するには、右上の×印をクリックします。

![image39](img/image39.png)

最終的には、CloudWatch Logs でジオフェンスのイベントが表示されるところまで確認してください。

## Amazon EventBridgeを設定する

![architecture3](img/architecture3.png)

現時点ではGPSマルチユニットの位置情報がジオフェンスに入ったり出たりしたイベントは、CloudWatch Logsに出力されています。  
このイベントをDiscordにも送るように設定します。

AWSコンソールの検索窓に”event"と入力し、表示されたサービスの一覧から"Amazon EventBridge"をクリックします。

![Amazon EventBridgeの選択](img/image40.png)

左のメニューの"ルール"をクリックすると、先ほどジオフェンスを作成した際に作成されたルールがあるのでこれをクリックします。

![ルールの選択](img/image41.png)

これまではこのルールでジオフェンスの全てのイベントを対象にしていましたが、ここからは入ったときと出たときのイベントでメッセージを変えたいのでフィルターを設定します。
画面右のペインの"トリガーイベント"のところの"イベントパターン(フィルター)"をクリックし、編集を開きます。

![イベントパターンの編集](img/image42.png)

"EventType"のところで"演算子"で"等しい"を選び、"値"に`ENTER`と入れます。これで、ジオフェンスに入ったイベントがこのルールの対象になります。
入力したら"更新"をクリックします。

![イベントパターンの編集完了](img/image43.png)

次に"ターゲット"タブをクリックし、編集を開きます。

![ターゲットの編集](img/image44.png)

"EventBridge API送信先"を探します。これをドラッグして画面右のペインの"ターゲット"のところにドロップします。

![EventBridge API送信先の追加](img/image45.png)

ドロップした"EventBridge API送信先"をクリックして、"ターゲット設定"画面を開きます。画面右ペインの下側に表示されます。
"EventBridge APIの宛先を作成"をクリックすると、別のタブまたはウインドウが開きますので、以下のように入力します。

![API送信先の設定](img/image46.png)

| 項目                     | 値                                     |
| ------------------------ | -------------------------------------- |
| 名前                     | `GPSMultiUnitHandsonDiscord`           |
| API 送信先エンドポイント | 運営から提供されたDiscordのWebhook URL |
| HTTPメソッド             | POST                                   |

![API送信先の設定](img/image47.png)

"接続タイプ"で"新しい接続を作成"を選択し、以下のように入力します。

| 項目       | 値                                      |
| ---------- | --------------------------------------- |
| 接続名     | `GPSMultiUnitHandsonDiscordConnection`  |
| APIタイプ  | "パブリック"を選択                      |
| 認証タイプ | "カスタム設定"を選択し、"APIキー"を選択 |
| APIキー名  | `x-api-key`                             |
| 値         | `GPSMultiUnitHandsonDiscordAPIKey`      |

DiscordのWebhook URLはURL自体に認証情報が含まれているため実際はAPIキーは必要ないのですが、EventBridge API送信先の接続の認証タイプで"カスタム設定"を選択した場合、APIキーの入力が必須になるため、適当な値を入れてください。

"作成"をクリックします。

![接続の設定](img/image48.png)

EventBridge の画面 (タブ) に戻り、"API送信先"のプルダウンの右側にある再読み込みボタンを押して、先ほど作成した送信先を選択します。

"更新"を押して設定を保存します。

![ターゲットの設定完了](img/image49.png)

次に、このAPI送信先に対してどのような内容のデータを送るかを設定します。画面右ペインの"ターゲット"の中で、"入力変換"を押して編集画面を開きます。

"ターゲット入力変換"のスライダーを"有効化"にし、"変換方法"で"入力トランスフォーマー"を選択します。  
"入力パス"に以下を貼り付けます。

```json
{
  "deviceId": "$.detail.DeviceId"
}
```

そして、テンプレートに以下を貼り付けます。

```json
{
  "content": "いってらっしゃい、 <deviceId>"
}
```

"更新"をクリックして保存します。

![入力変換の設定完了](img/image50.png)

続けて、ジオフェンスから出たときのイベントも同様に設定します。

EventBridgeのページに戻り、"ルール"から"ルールを作成"をクリックします。

![新しいルールの作成](img/image51.png)

画面左のペインの"イベント"で"AWSサービスイベント"を選び、"Location Geofence Event"を選んで画面右のペインのトリガーイベントにドラッグアンドドロップします。  
イベントパターン(フィルター)を開き、"EventType"のところで"演算子"で"等しい"を選び、"値"に`EXIT`と入れます。これで、ジオフェンスから出たイベントがこのルールの対象になります。

![ジオフェンス退出イベントのフィルター設定](img/image52.png)

続いて先ほどと同じく"ターゲット"を設定していきます。"API送信先"は先ほど作ったものがあるのでそれを選択します。

![API送信先の選択](img/image53.png)

"ターゲット"の"入力変換"も先ほどと同様に設定し、JSONの値は以下のように設定します。

```json
{
  "content": "おかえりなさい、 <deviceId>"
}
```

![退出イベント用の入力変換設定](img/image54.png)

"作成"をクリックし、"Rule name"に`GPSMultiUnitHandsonGeofenceExit`と入力して、"作成"をクリックします。

![ルール作成の完了](img/image55.png)

## 動作確認(2)

先ほどと同じく、IoT CoreのページからMQTTテストクライアントを開いて、ジオフェンスの中と外の位置情報を交互に発行してみてください。正しく設定されていれば、Discordにあなたの設定したGPSマルチユニットのデバイス名を含んだメッセージが届きます。

![Discordでのメッセージ表示](img/image56.png)

## 動作確認(3)

GPSマルチユニットを持って、建物の外に出て散歩して戻ってきてみてください。Discordに先ほどと同じくメッセージが届いていれば成功です。

次:  
Advanced: [中・上級者向け追加コンテンツ](../chapter5/README.md)  
99: [後片付け](../chapter99/README.md)

前: [3: SORACOM Funnel設定](../chapter3/README.md)
