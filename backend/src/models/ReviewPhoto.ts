import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Review } from "./Review";

@Entity("review_photos")
export class ReviewPhoto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255 })
  url: string;

  @ManyToOne(() => Review, (review) => review.photos, { onDelete: "CASCADE" })
  review: Review;
}
