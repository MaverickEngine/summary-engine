export function apiPost(path, data) {
    return new Promise((resolve, reject) => {
        wp.apiRequest({
            path,
            data,
            type: "POST",
        })
        .done(async (response) => {
            if (response.error) {
                reject(response);
            }
            resolve(response);
        })
        .fail(async (response) => {
            reject(response.responseJSON?.message || response.statusText || response.responseText || response);
        });
    });
}

export function apiGet(path) {
    return new Promise((resolve, reject) => {
        wp.apiRequest({
            path,
            type: "GET",
        })
        .done(async (response) => {
            if (response.error) {
                reject(response);
            }
            resolve(response);
        })
        .fail(async (response) => {
            reject(response.responseJSON?.message || response.statusText || response.responseText || response);
        });
    });
}

export function apiDelete(path) {
    return new Promise((resolve, reject) => {
        wp.apiRequest({
            path,
            type: "DELETE",
        })
        .done(async (response) => {
            if (response.error) {
                reject(response);
            }
            resolve(response);
        })
        .fail(async (response) => {
            reject(response.responseJSON?.message || response.statusText || response.responseText || response);
        });
    });
}