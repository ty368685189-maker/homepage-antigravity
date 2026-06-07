type ImageModule = {
	default: {
		src: string;
	};
};

function normalizeImagePath(path: string) {
	return path
		.replace(/\\/g, "/")
		.replace(/^(\.\/)+/, "")
		.replace(/^(\.\.\/)+/, "");
}

export function resolveImageSrc(
	image: string | { src: string } | undefined,
	images: Record<string, ImageModule>,
) {
	if (!image) return undefined;
	if (typeof image !== "string") return image.src;

	const normalizedImage = normalizeImagePath(image);
	const match = Object.entries(images).find(([key]) => {
		return normalizeImagePath(key) === normalizedImage;
	});

	return match?.[1].default.src || image;
}
