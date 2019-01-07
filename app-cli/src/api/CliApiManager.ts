import ApiManager from './ApiManager';
import { IHashMapGeneric } from '../models/IHashMapGeneric';
import StorageHelper from '../utils/StorageHelper';
import { IMachine } from '../models/storage/StoredObjects';

function hashCode(str: string) {
	var hash = 0,
		i,
		chr;
	if (str.length === 0) return hash;
	for (i = 0; i < str.length; i++) {
		chr = str.charCodeAt(i);
		hash = (hash << 5) - hash + chr;
		hash |= 0; // Convert to 32bit integer
	}
	return hash;
}

export default class CliApiManager {
	static instances: IHashMapGeneric<ApiManager> = {};

	static get(capMachine: IMachine) {
		const hashKey = 'v' + hashCode(capMachine.baseUrl);
		if (!CliApiManager.instances[hashKey])
			CliApiManager.instances[hashKey] = new ApiManager(capMachine.baseUrl + '/api/v1', function(token) {
				capMachine.authToken = token;
				if (capMachine.name) StorageHelper.get().saveMachine(capMachine);
				return Promise.resolve();
			});

		CliApiManager.instances[hashKey].setAuthToken(capMachine.authToken);

		return CliApiManager.instances[hashKey];
	}
}
