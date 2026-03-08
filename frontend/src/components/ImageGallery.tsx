import { useState } from "react";
import "./ImageGallery.css";

interface ImageGalleryProps {
  images: string[];
  alt: string;
}

export default function ImageGallery({ images, alt }: ImageGalleryProps) {
  const [index, setIndex] = useState(0);

  if (images.length === 0) return null;

  const prev = () => setIndex((i) => (i === 0 ? images.length - 1 : i - 1));
  const next = () => setIndex((i) => (i === images.length - 1 ? 0 : i + 1));

  return (
    <div className="gallery">
      <div className="gallery__viewport">
        <img
          src={images[index]}
          alt={`${alt} — view ${index + 1}`}
          loading="lazy"
        />
        {images.length > 1 && (
          <>
            <button className="gallery__arrow gallery__arrow--prev" onClick={prev} aria-label="Previous image">
              &#8249;
            </button>
            <button className="gallery__arrow gallery__arrow--next" onClick={next} aria-label="Next image">
              &#8250;
            </button>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="gallery__dots">
          {images.map((_, i) => (
            <button
              key={i}
              className={`gallery__dot ${i === index ? "gallery__dot--active" : ""}`}
              onClick={() => setIndex(i)}
              aria-label={`View image ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
