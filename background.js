// 拡張機能アイコンクリックで新しいタブを開く
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: 'usdm.html' });
});
