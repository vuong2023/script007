/*
Thời gian cập nhật：2024.05.14 15:48
Cập nhật nội dung: 404 mã trạng thái phán đoán thay đổi để mô-đun tham số tùy chỉnh lựa chọn giữ lại hoặc loại bỏ

Cấu hình Surge
https://raw.githubusercontent.com/vuong2023/script007/main/Surge/AUTOTF.sgmodule
Boxjs Đăng ký
https://raw.githubusercontent.com/vuong2023/script007/main/boxjs.json
*/

// Phân tích các tham số đã gửi
let args = {};
if ($argument) {
    $argument.split('&').forEach(arg => {
        let [key, value] = arg.split('=');
        args[key] = value;
    });
}

let handle404 = args['HANDLE_404'] === '1';

if (typeof $request !== 'undefined' && $request) {
    let url = $request.url;

    let keyPattern = /^https:\/\/testflight\.apple\.com\/v3\/accounts\/(.*?)\/apps/;
    let key = url.match(keyPattern) ? url.match(keyPattern)[1] : null;
    const handler = (appIdMatch) => {
        if (appIdMatch && appIdMatch[1]) {
            let appId = appIdMatch[1];
            let existingAppIds = $persistentStore.read('APP_ID');
            let appIdSet = new Set(existingAppIds ? existingAppIds.split(',') : []);
            if (!appIdSet.has(appId)) {
                appIdSet.add(appId);
                $persistentStore.write(Array.from(appIdSet).join(','), 'APP_ID');
                $notification.post('Tìm thấy APP_ID', '', `Đã lưu APP_ID: ${appId}`, {"auto-dismiss": 2});
                console.log(`Đã lưu APP_ID: ${appId}`);
            } else {
                $notification.post('APP_ID Lặp lại', '', `APP_ID: ${appId} Đã tồn tại, không cần thêm nhiều lần.`, {"auto-dismiss": 2});
                console.log(`APP_ID: ${appId} Đã tồn tại, không cần thêm nhiều lần.`);
            }
        } else {
            console.log('TestFlight không hợp lệ, không có APP_ID');
        }
    };
    if (/^https:\/\/testflight\.apple\.com\/v3\/accounts\/.*\/apps$/.test(url) && key) {
        let headers = Object.fromEntries(Object.entries($request.headers).map(([key, value]) => [key.toLowerCase(), value]));
        let session_id = headers['x-session-id'];
        let session_digest = headers['x-session-digest'];
        let request_id = headers['x-request-id'];

        $persistentStore.write(session_id, 'session_id');
        $persistentStore.write(session_digest, 'session_digest');
        $persistentStore.write(request_id, 'request_id');
        $persistentStore.write(key, 'key');

        let existingAppIds = $persistentStore.read('APP_ID');
        if (!existingAppIds) {
            $notification.post('Nhận thông tin thành công 🎉', '', 'Vui lòng chỉnh sửa các tham số mô-đun sau khi nhận APP_ID để vô hiệu hóa kịch bản', {"auto-dismiss": 10});
        }
        console.log(`Nhận thông tin thành công: session_id=${session_id}, session_digest=${session_digest}, request_id=${request_id}, key=${key}`);
    } else if (/^https:\/\/testflight\.apple\.com\/join\/([A-Za-z0-9]+)$/.test(url)) {
        const appIdMatch = url.match(/^https:\/\/testflight\.apple\.com\/join\/([A-Za-z0-9]+)$/);
        handler(appIdMatch);
    } else if (/v3\/accounts\/.*\/ru/.test(url)) {
        const appIdMatch = url.match(/v3\/accounts\/.*\/ru\/(.*)/);
        handler(appIdMatch);
    }

    $done({});
} else {
    !(async () => {
        let ids = $persistentStore.read('APP_ID');
        if (!ids) {
            console.log('Không tìm thấy APP_ID');
            $done();
        } else {
            ids = ids.split(',');
            for await (const ID of ids) {
                await autoPost(ID, ids);
            }
            if (ids.length === 0) {
                $notification.post('Tất cả TestFlight đã được thêm vào 🎉', '', 'Mô-đun đã tự động tắt và ngừng chạy', {"sound": true});
                $done($httpAPI('POST', '/v1/modules', {'Giám sát beta công khai': false}));
            } else {
                $done();
            }
        }
    })();
}

async function autoPost(ID, ids) {
    let Key = $persistentStore.read('key');
    let testurl = `https://testflight.apple.com/v3/accounts/${Key}/ru/`;
    let header = {
        'X-Session-Id': $persistentStore.read('session_id'),
        'X-Session-Digest': $persistentStore.read('session_digest'),
        'X-Request-Id': $persistentStore.read('request_id')
    };

    return new Promise((resolve) => {
        $httpClient.get({ url: testurl + ID, headers: header }, (error, response, data) => {
            if (error) {
                console.log(`${ID} Tham gia không thành công ${error}，đã lưu APP_ID`);
                resolve();
                return;
            }

            if (response.status === 500) {
                console.log(`${ID} Lỗi máy chủ，Mã lỗi 500，đã lưu APP_ID`);
                resolve();
                return;
            }

            if (response.status === 404) {
                if (handle404) {
                    console.log(`${ID} Liên kết không hợp lệ: mã trạng thái lỗi 404，Tự động gỡ bỏ APP_ID`);
                    ids.splice(ids.indexOf(ID), 1);
                    $persistentStore.write(ids.join(','), 'APP_ID');
                    $notification.post('Liên kết không hợp lệ', '', `${ID} Mã trạng thái lỗi 404, đã được xóa tự động`, {"auto-dismiss": 2});
                } else {
                    console.log(`${ID} Liên kết không hợp lệ: Mã trạng thái lỗi 404, vui lòng xóa APP_ID trong BoxJs hoặc tham số mô-đun`);
                    $notification.post('Liên kết không hợp lệ', '', `${ID} Mã trạng thái lỗi 404, vui lòng xóa APP_ID trong BoxJs hoặc tham số mô-đun`, {"auto-dismiss": 2});
                }
                resolve();
                return;
            }

            if (response.status !== 200) {
                console.log(`${ID} Liên kết không hợp lệ: mã trạng thái ${response.status}，đã xóa APP_ID`);
                ids.splice(ids.indexOf(ID), 1);
                $persistentStore.write(ids.join(','), 'APP_ID');
                $notification.post('Không phải là liên kết TestFlight hợp lệ', '', `${ID} đã bị loại bỏ`, {"auto-dismiss": 2});
                resolve();
                return;
            }

            let jsonData;
            try {
                jsonData = JSON.parse(data);
            } catch (parseError) {
                console.log(`${ID} Phân tích phản hồi không thành công: ${parseError}，Đã lưu APP_ID`);
                resolve();
                return;
            }

            if (!jsonData || !jsonData.data) {
                console.log(`${ID} Không nhận người mới: Đã lưu APP_ID`);
                resolve();
                return;
            }

            if (jsonData.data.status === 'FULL') {
                console.log(`${ID} Bản beta đầy: Đã lưu APP_ID`);
                resolve();
                return;
            }

            $httpClient.post({ url: testurl + ID + '/accept', headers: header }, (error, response, body) => {
                if (!error && response.status === 200) {
                    let jsonBody;
                    try {
                        jsonBody = JSON.parse(body);
                    } catch (parseError) {
                        console.log(`${ID} Tham gia không thành công: ${parseError}，Đã lưu APP_ID`);
                        resolve();
                        return;
                    }

                    console.log(`${jsonBody.data.name} TestFlight đã tham gia thành công🎉🎉🎉`);
                    ids.splice(ids.indexOf(ID), 1);
                    $persistentStore.write(ids.join(','), 'APP_ID');
                    if (ids.length > 0) {
                        $notification.post(jsonBody.data.name + ' TestFlight đã tham gia thành công🎉🎉🎉', '', `Tiếp tục thực thi APP         ID: ${ids.join(',')}`, {"sound": true});
                    } else {
                        $notification.post(jsonBody.data.name + ' TestFlight đã tham gia thành công🎉🎉🎉', '', 'Tất cả ID ứng dụng đã được xử lý', {"sound": true});
                    }
                } else {
                    console.log(`${ID} Không thể tham gia: ${error || `mã trạng thái lỗi ${response.status}`}，Đã lưu APP_ID`);
                }
                resolve();
            });
        });
    });
}
