const ora = require('ora');

class SpinnerHelper {
	private spinner: any;

	start(message: string) {
		this.spinner = ora(message).start();
	}

	setColor(color: string) {
		this.spinner.color = color;
	}

	stop() {
		this.spinner.stop();
	}

	succeed() {
		this.spinner.succeed();
	}

	fail() {
		this.spinner.fail();
	}
}

export default new SpinnerHelper();
