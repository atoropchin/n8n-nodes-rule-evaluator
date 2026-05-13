import gulp from 'gulp';

const { src, dest } = gulp;

function buildIcons() {
	return src(['nodes/**/*.svg']).pipe(dest('dist/nodes'));
}

gulp.task('build:icons', buildIcons);

export { buildIcons };
export default buildIcons;
