export const OFFLINE_QUEUE_KEY = 'offline_sync_queue';

export const saveToOfflineQueue = (endpoint, method, data, type = 'general') => {
  const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
  
  const newItem = {
    id: Date.now().toString(),
    endpoint,
    method,
    data,
    type,
    timestamp: new Date().toISOString()
  };
  
  queue.push(newItem);
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  return newItem;
};

export const getOfflineQueue = () => {
  return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
};

export const clearFromQueue = (id) => {
  const queue = getOfflineQueue();
  const newQueue = queue.filter(item => item.id !== id);
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(newQueue));
};

export const hasPendingSync = () => {
  return getOfflineQueue().length > 0;
};

export const processOfflineQueue = async (apiInstance) => {
  const queue = getOfflineQueue();
  if (queue.length === 0) return { success: 0, failed: 0 };
  
  let successCount = 0;
  let failCount = 0;
  
  for (const item of queue) {
    try {
      if (item.method === 'POST') {
        await apiInstance.post(item.endpoint, item.data);
      } else if (item.method === 'PUT') {
        await apiInstance.put(item.endpoint, item.data);
      }
      clearFromQueue(item.id);
      successCount++;
    } catch (error) {
      console.error('Error syncing offline item', item, error);
      failCount++;
    }
  }
  
  return { success: successCount, failed: failCount };
};
