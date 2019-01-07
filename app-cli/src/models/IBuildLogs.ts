export default interface IBuildLogs {
	isAppBuilding: boolean;
	isBuildFailed: boolean;
	logs: {
		firstLineNumber: number;
		lines: string[];
	};
};
